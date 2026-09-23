import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { schools, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("School Active/Inactive Status & Access Gating Verification", () => {
  let server: http.Server;
  let baseUrl: string;
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;

  let superAdminToken: string;
  let superAdminId: number;

  let schoolId: number;
  let schoolCode: string;
  let schoolAdminId: number;
  let schoolAdminOpenId: string;
  let schoolAdminPassword = "SchoolPassword123!";
  let schoolAdminToken: string;

  beforeAll(async () => {
    const maybeDb = await getDb();
    if (!maybeDb) throw new Error("Database required");
    db = maybeDb;

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
    const adminEmail = `admin_status_${ts}@test.local`;
    const pwdHash = await hashPassword("AdminPass123!");

    // 1. Create Super Admin
    const [adminUserRes] = await db.insert(users).values({
      openId: `admin_status_${ts}`,
      email: adminEmail,
      name: "Status Test Super Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    superAdminId = Number(adminUserRes.insertId);

    const adminLogin = await loginUser(adminEmail, "AdminPass123!");
    if (!adminLogin) throw new Error("Admin login failed");
    superAdminToken = adminLogin.token;

    // 2. Create Test School
    schoolCode = `ST${String(ts).slice(-6)}`;
    const [schoolRes] = await db.insert(schools).values({
      name: `Status Test School ${ts}`,
      shortCode: schoolCode,
      email: `school_${ts}@test.local`,
      isActive: true,
    });
    schoolId = Number(schoolRes.insertId);

    // 3. Create School Admin User
    schoolAdminOpenId = `SCH_${schoolCode}`;
    const schoolPwdHash = await hashPassword(schoolAdminPassword);
    const [schoolUserRes] = await db.insert(users).values({
      openId: schoolAdminOpenId,
      email: `admin_${schoolCode}@test.local`,
      name: "Status Test School Admin",
      role: "SCHOOL_ADMIN",
      schoolId,
      passwordHash: schoolPwdHash,
      loginMethod: "local",
      isActive: true,
    });
    schoolAdminId = Number(schoolUserRes.insertId);

    const schoolLogin = await loginUser(schoolAdminOpenId, schoolAdminPassword);
    if (!schoolLogin) throw new Error("School admin login failed");
    schoolAdminToken = schoolLogin.token;
  });

  afterAll(async () => {
    try {
      await db.delete(users).where(eq(users.id, schoolAdminId));
      await db.delete(users).where(eq(users.id, superAdminId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    } catch {
      // ignore cleanup errors
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("1. School is initially Active", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(true);
  });

  it("2. Active school admin can log in and call authenticated endpoints", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: schoolAdminOpenId, password: schoolAdminPassword }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeDefined();

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.schoolId).toBe(schoolId);
  });

  it("3. Non-super-admins cannot toggle school status (returns 403)", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolAdminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(403);
  });

  it("4. Unauthenticated request to toggle status is rejected (returns 401)", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(401);
  });

  it("5. Super Admin deactivates school (PATCH /api/schools/:id/status)", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.school?.isActive).toBe(false);

    // Verify persistence in DB
    const [row] = await db.select().from(schools).where(eq(schools.id, schoolId));
    expect(row.isActive).toBe(false);
  });

  it("6. Deactivated school blocks school admin login with 403 Forbidden", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: schoolAdminOpenId, password: schoolAdminPassword }),
    });
    expect(loginRes.status).toBe(403);
    const err = await loginRes.json();
    expect(err.error).toMatch(/inactive/i);
  });

  it("7. Deactivated school invalidates existing session token (returns 401)", async () => {
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${schoolAdminToken}` },
    });
    expect(meRes.status).toBe(401);
  });

  it("8. Super Admin remains fully active and can still access the platform", async () => {
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    expect(meRes.status).toBe(200);
  });

  it("9. Super Admin reactivates school (POST /api/schools/:id/status)", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.school?.isActive).toBe(true);

    // Verify persistence in DB
    const [row] = await db.select().from(schools).where(eq(schools.id, schoolId));
    expect(row.isActive).toBe(true);
  });

  it("10. Reactivated school restores login and API access immediately", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: schoolAdminOpenId, password: schoolAdminPassword }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeDefined();

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.schoolId).toBe(schoolId);
  });
});
