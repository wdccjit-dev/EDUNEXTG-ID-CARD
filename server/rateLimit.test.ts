import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { createRateLimiter } from "./_core/rateLimit";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { hashPassword } from "./appAuth";
import { eq } from "drizzle-orm";

describe("Login & Auth Rate Limiting Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof getDb>>;

  const existingEmail = `ratelimit_user_${Date.now()}@test.local`;
  const existingPassword = "CorrectPassword123!";
  let existingUserId: number | undefined;

  beforeAll(async () => {
    // Explicitly enable rate limiting for this test suite
    process.env.DISABLE_RATE_LIMIT = "0";

    db = await getDb();
    if (!db) throw new Error("Database required for test");

    const pwdHash = await hashPassword(existingPassword);
    const [inserted] = await db.insert(users).values({
      openId: `ratelimit_user_${Date.now()}`,
      email: existingEmail,
      name: "Rate Limit Test User",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    existingUserId = Number(inserted.insertId);

    const app = express();
    app.use(express.json());

    // Replicate separate limiter instances matching server/_core/index.ts
    app.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    app.use("/api/auth/forgot-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }));
    app.use("/api/auth/reset-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }));
    app.use("/api", apiRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Server failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    // Restore DISABLE_RATE_LIMIT
    process.env.DISABLE_RATE_LIMIT = "1";
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (db && existingUserId) {
      await db.delete(users).where(eq(users.id, existingUserId));
    }
  });

  it("51st login request from one IP in the window returns 429", async () => {
    // Create dedicated app/server to test IP rate limiting with a clean limiter instance
    const ipApp = express();
    ipApp.use(express.json());
    ipApp.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    ipApp.use("/api", apiRouter);

    const ipServer = http.createServer(ipApp);
    await new Promise<void>((resolve) => ipServer.listen(0, "127.0.0.1", () => resolve()));
    const ipAddr = ipServer.address() as any;
    const ipBaseUrl = `http://127.0.0.1:${ipAddr.port}`;

    try {
      // Send 50 login requests from this IP with a unique identifier so account lockout is not triggered
      for (let i = 1; i <= 50; i++) {
        const res = await fetch(`${ipBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `ip_test_${i}_${Date.now()}@test.local`,
            password: "SomePassword123!",
          }),
        });
        expect(res.status).toBe(401);
      }

      // 51st request from same IP
      const res51 = await fetch(`${ipBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `ip_test_51_${Date.now()}@test.local`,
          password: "SomePassword123!",
        }),
      });

      expect(res51.status).toBe(429);
      expect(res51.headers.get("retry-after")).toBeDefined();
      const body = await res51.json();
      expect(body).toEqual({ error: "Too many requests. Please try again later." });
    } finally {
      await new Promise<void>((resolve) => ipServer.close(() => resolve()));
    }
  });

  it("Reset-password requests do not consume the login quota", async () => {
    const quotaApp = express();
    quotaApp.use(express.json());
    quotaApp.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    quotaApp.use("/api/auth/reset-password", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }));
    quotaApp.use("/api", apiRouter);

    const quotaServer = http.createServer(quotaApp);
    await new Promise<void>((resolve) => quotaServer.listen(0, "127.0.0.1", () => resolve()));
    const quotaAddr = quotaServer.address() as any;
    const quotaBaseUrl = `http://127.0.0.1:${quotaAddr.port}`;

    try {
      // Exhaust the reset-password quota (10 requests)
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${quotaBaseUrl}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "invalid-token",
            password: "SomeNewPassword123!",
          }),
        });
        expect([400, 429]).toContain(res.status);
      }

      // 11th reset-password request is rate limited (429)
      const res11 = await fetch(`${quotaBaseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "invalid-token",
          password: "SomeNewPassword123!",
        }),
      });
      expect(res11.status).toBe(429);

      // Verify login quota is unaffected and can process requests
      const loginRes = await fetch(`${quotaBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: existingEmail,
          password: existingPassword,
        }),
      });
      expect(loginRes.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => quotaServer.close(() => resolve()));
    }
  });

  it("10 failed logins for one identifier lock that identifier (429) even when requests come from different IPs", async () => {
    // To simulate different IPs, we set trust proxy so req.ip is taken from X-Forwarded-For
    const multiIpApp = express();
    multiIpApp.set("trust proxy", true);
    multiIpApp.use(express.json());
    multiIpApp.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }));
    multiIpApp.use("/api", apiRouter);

    const multiIpServer = http.createServer(multiIpApp);
    await new Promise<void>((resolve) => multiIpServer.listen(0, "127.0.0.1", () => resolve()));
    const multiIpAddr = multiIpServer.address() as any;
    const multiIpBaseUrl = `http://127.0.0.1:${multiIpAddr.port}`;

    const targetAccount = `locked_target_${Date.now()}@test.local`;

    try {
      // 10 failed logins from 10 distinct simulated IPs
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${multiIpBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `192.168.1.${i}`,
          },
          body: JSON.stringify({
            email: targetAccount,
            password: "WrongPassword123!",
          }),
        });
        expect(res.status).toBe(401);
      }

      // 11th attempt from yet another distinct IP (e.g., 10.0.0.99)
      const lockedRes = await fetch(`${multiIpBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "10.0.0.99",
        },
        body: JSON.stringify({
          email: targetAccount,
          password: "WrongPassword123!",
        }),
      });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.headers.get("retry-after")).toBeDefined();
      const body = await lockedRes.json();
      expect(body).toEqual({ error: "Too many requests. Please try again later." });
    } finally {
      await new Promise<void>((resolve) => multiIpServer.close(() => resolve()));
    }
  });

  it("A successful login resets that identifier's failure count", async () => {
    const successUserEmail = `reset_count_user_${Date.now()}@test.local`;
    const pwdHash = await hashPassword(existingPassword);
    const [inserted] = await db!.insert(users).values({
      openId: `reset_user_${Date.now()}`,
      email: successUserEmail,
      name: "Reset Count User",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const createdUserId = Number(inserted.insertId);

    try {
      // Fail 9 times (just below lockout threshold of 10)
      for (let i = 1; i <= 9; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: successUserEmail,
            password: "WrongPassword123!",
          }),
        });
        expect(failRes.status).toBe(401);
      }

      // Successful login resets the failure count
      const okRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: successUserEmail,
          password: existingPassword,
        }),
      });
      expect(okRes.status).toBe(200);

      // Now 9 more failures should NOT lock the account yet (threshold is 10)
      for (let i = 1; i <= 9; i++) {
        const failRes = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: successUserEmail,
            password: "WrongPassword123!",
          }),
        });
        expect(failRes.status).toBe(401);
      }
    } finally {
      await db!.delete(users).where(eq(users.id, createdUserId));
    }
  });

  it("Identifier matching is case-insensitive and trims whitespace", async () => {
    const caseUser = `case_trim_${Date.now()}@test.local`;

    // Fail 9 times with whitespace and varying uppercase/lowercase
    for (let i = 1; i <= 9; i++) {
      const formatted = i % 2 === 0 ? `  ${caseUser.toUpperCase()}  ` : ` \t${caseUser} \n `;
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formatted,
          password: "WrongPassword123!",
        }),
      });
      expect(res.status).toBe(401);
    }

    // 10th failure using standard lowercase
    const tenthRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: caseUser,
        password: "WrongPassword123!",
      }),
    });
    expect(tenthRes.status).toBe(401);

    // 11th attempt with spaces and uppercase should be locked (429)
    const lockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `   ${caseUser.toUpperCase()}   `,
        password: "WrongPassword123!",
      }),
    });
    expect(lockedRes.status).toBe(429);
    expect(lockedRes.headers.get("retry-after")).toBeDefined();
    const body = await lockedRes.json();
    expect(body).toEqual({ error: "Too many requests. Please try again later." });
  });

  it("Unknown-user and wrong-password failures produce identical responses", async () => {
    // 1. Existing user with wrong password
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: existingEmail,
        password: "WrongPassword999!",
      }),
    });
    const wrongPassBody = await wrongPassRes.json();

    // 2. Unknown non-existent user
    const unknownUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `non_existent_${Date.now()}@test.local`,
        password: "WrongPassword999!",
      }),
    });
    const unknownUserBody = await unknownUserRes.json();

    expect(wrongPassRes.status).toBe(401);
    expect(unknownUserRes.status).toBe(401);
    expect(wrongPassBody).toEqual(unknownUserBody);
    expect(wrongPassBody).toEqual({ error: "Invalid username or password" });
  });
});
