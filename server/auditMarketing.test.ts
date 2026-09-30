import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { auditLogs, schools, users } from "../drizzle/schema";

describe("Audit Logs: Marketing Logs Toggle & CSV Export", () => {
  let server: http.Server;
  let baseUrl: string;
  let superAdminToken: string;
  let marketingToken: string;
  let schoolId: number;
  let superAdminId: number;
  let marketingAdminId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database required");

    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Server failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const ts = Date.now();
    const pwdHash = await hashPassword("TestPass123!");

    // Create school
    const [sRes] = await db.insert(schools).values({
      name: `Audit School ${ts}`,
      shortCode: `AS${Math.floor(100 + Math.random() * 900)}`,
      email: `audit_${ts}@test.local`,
      isActive: true,
    });
    schoolId = Number(sRes.insertId);

    // Create Super Admin
    const saEmail = `sa_aud_${ts}@test.local`;
    const [saRes] = await db.insert(users).values({
      openId: `sa_aud_${ts}`,
      email: saEmail,
      name: "Super Admin Auditor",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    superAdminId = Number(saRes.insertId);
    const saLogin = await loginUser(saEmail, "TestPass123!");
    superAdminToken = saLogin!.token;

    // Create Marketing Admin
    const mktEmail = `mkt_aud_${ts}@test.local`;
    const [mktRes] = await db.insert(users).values({
      openId: `mkt_aud_${ts}`,
      email: mktEmail,
      name: "Marketing Auditor",
      role: "MARKETING_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    marketingAdminId = Number(mktRes.insertId);
    const mktLogin = await loginUser(mktEmail, "TestPass123!");
    marketingToken = mktLogin!.token;

    // Direct audit logs insertion to test pure actorRole filtering
    await db.insert(auditLogs).values([
      {
        userId: superAdminId,
        actorRole: "SUPER_ADMIN",
        action: "TEST_SUPER_ACTION",
        entityType: "system",
        entityId: 1,
        schoolId,
        newValues: { detail: "Super admin only operation" },
      },
      {
        userId: marketingAdminId,
        actorRole: "MARKETING_ADMIN",
        action: "PLACE_ORDER",
        entityType: "order",
        entityId: 101,
        schoolId,
        newValues: { orderNumber: `ORD-MKT-${ts}`, placedByRole: "MARKETING_ADMIN" },
      },
    ]);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  it("Without marketing parameter, audit logs returns all actions", async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: authHeader(superAdminToken),
    });
    expect(res.status).toBe(200);
    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);

    const actions = logs.map((l: any) => l.action);
    expect(actions).toContain("TEST_SUPER_ACTION");
    expect(actions).toContain("PLACE_ORDER");
  });

  it("With marketing=1 filter, returns only marketing-role logs", async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs?marketing=1`, {
      headers: authHeader(superAdminToken),
    });
    expect(res.status).toBe(200);
    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    for (const log of logs) {
      expect(log.isMarketing).toBe(true);
      expect(log.action).not.toBe("TEST_SUPER_ACTION");
    }

    const hasMktOrder = logs.some((l: any) => l.action === "PLACE_ORDER");
    expect(hasMktOrder).toBe(true);
  });

  it("CSV export respects marketing=1 filter", async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs?marketing=1&export=csv`, {
      headers: authHeader(superAdminToken),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");

    const csvText = await res.text();
    expect(csvText).toContain("PLACE_ORDER");
    expect(csvText).toContain("MARKETING_ADMIN");
    expect(csvText).not.toContain("TEST_SUPER_ACTION");
  });
});
