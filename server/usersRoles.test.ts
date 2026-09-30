import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { users, schools } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Users Section: Role Restrictions on Creation", () => {
  let server: http.Server;
  let baseUrl: string;
  let superAdminToken: string;
  let testSchoolId: number;

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

    // Create a School
    const [schRes] = await db.insert(schools).values({
      name: `User Test School ${ts}`,
      shortCode: `US${Math.floor(100 + Math.random() * 900)}`,
      email: `school_${ts}@test.local`,
      isActive: true,
    });
    testSchoolId = Number(schRes.insertId);

    // Create Super Admin
    const superAdminEmail = `sa_usrtest_${ts}@test.local`;
    await db.insert(users).values({
      openId: `sa_usrtest_${ts}`,
      email: superAdminEmail,
      name: "Users Test Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const saLogin = await loginUser(superAdminEmail, "TestPass123!");
    superAdminToken = saLogin!.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const authHeader = () => ({
    Authorization: `Bearer ${superAdminToken}`,
    "Content-Type": "application/json",
  });

  it("Accepts SUPER_ADMIN and stores schoolId as null even if client sends a schoolId", async () => {
    const ts = Date.now();
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        openId: `sa_new_${ts}`,
        name: "New Admin",
        email: `new_admin_${ts}@test.local`,
        password: "Password123!",
        role: "SUPER_ADMIN",
        schoolId: 999, // Should be ignored
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("SUPER_ADMIN");
    expect(body.schoolId).toBeNull();

    // Verify in DB directly
    const db = (await getDb())!;
    const userInDb = (await db.select().from(users).where(eq(users.id, body.id)))[0];
    expect(userInDb.schoolId).toBeNull();
  });

  it("Accepts SCHOOL_ADMIN with schoolId and stores it, or stores null if none", async () => {
    const ts = Date.now();
    const resWithSchool = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        openId: `sch_new_${ts}`,
        name: "New School Admin",
        email: `new_schadmin_${ts}@test.local`,
        password: "Password123!",
        role: "SCHOOL_ADMIN",
        schoolId: testSchoolId,
      }),
    });

    expect(resWithSchool.status).toBe(201);
    const bodyWithSchool = await resWithSchool.json();
    expect(bodyWithSchool.role).toBe("SCHOOL_ADMIN");
    expect(bodyWithSchool.schoolId).toBe(testSchoolId);

    const db = (await getDb())!;
    const userInDb = (await db.select().from(users).where(eq(users.id, bodyWithSchool.id)))[0];
    expect(userInDb.schoolId).toBe(testSchoolId);
  });

  it("Accepts MARKETING_ADMIN and stores schoolId as null", async () => {
    const ts = Date.now();
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        openId: `mkt_new_${ts}`,
        name: "New Marketing Admin",
        email: `new_mktadmin_${ts}@test.local`,
        password: "Password123!",
        role: "MARKETING_ADMIN",
        schoolId: 777,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("MARKETING_ADMIN");
    expect(body.schoolId).toBeNull();

    const db = (await getDb())!;
    const userInDb = (await db.select().from(users).where(eq(users.id, body.id)))[0];
    expect(userInDb.schoolId).toBeNull();
  });

  it("Rejects creation with SCHOOL_OPERATOR or VIEWER role", async () => {
    const ts = Date.now();
    const resOperator = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        openId: `op_new_${ts}`,
        name: "Old Operator",
        email: `op_${ts}@test.local`,
        password: "Password123!",
        role: "SCHOOL_OPERATOR",
      }),
    });
    expect(resOperator.status).toBe(400);

    const resViewer = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        openId: `view_new_${ts}`,
        name: "Old Viewer",
        email: `view_${ts}@test.local`,
        password: "Password123!",
        role: "VIEWER",
      }),
    });
    expect(resViewer.status).toBe(400);
  });
});
