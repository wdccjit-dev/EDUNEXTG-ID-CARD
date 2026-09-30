import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { schools, users } from "../drizzle/schema";

describe("RBAC: MARKETING_ADMIN Role Restrictions & Order Permissions", () => {
  let server: http.Server;
  let baseUrl: string;
  let marketingToken: string;
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

    // Create a Super Admin
    const superAdminEmail = `super_admin_rbac_${ts}@test.local`;
    await db.insert(users).values({
      openId: `super_rbac_${ts}`,
      email: superAdminEmail,
      name: "Super Admin RBAC",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const adminLogin = await loginUser(superAdminEmail, "TestPass123!");
    if (!adminLogin) throw new Error("Could not log in as super admin");
    superAdminToken = adminLogin.token;

    // Create an active school
    const [schoolRes] = await db.insert(schools).values({
      name: `RBAC Marketing School ${ts}`,
      shortCode: `MKT${Math.floor(100 + Math.random() * 900)}`,
      email: `school_${ts}@mkt.test`,
      isActive: true,
    });
    testSchoolId = Number(schoolRes.insertId);

    // Create a Marketing Admin
    const marketingEmail = `marketing_admin_${ts}@test.local`;
    await db.insert(users).values({
      openId: `mkt_rbac_${ts}`,
      email: marketingEmail,
      name: "Marketing Admin User",
      role: "MARKETING_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const mktLogin = await loginUser(marketingEmail, "TestPass123!");
    if (!mktLogin) throw new Error("Could not log in as marketing admin");
    marketingToken = mktLogin.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const authHeader = () => ({
    Authorization: `Bearer ${marketingToken}`,
    "Content-Type": "application/json",
  });

  it("MARKETING_ADMIN gets 403 on templates", async () => {
    const res = await fetch(`${baseUrl}/api/templates`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on id-cards", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on approvals", async () => {
    const res = await fetch(`${baseUrl}/api/approvals`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on approved cards", async () => {
    const res = await fetch(`${baseUrl}/api/approved-cards`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on card requests", async () => {
    const res = await fetch(`${baseUrl}/api/requests`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on print batch", async () => {
    const res = await fetch(`${baseUrl}/api/print/batch`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ cardIds: [1] }),
    });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on PDF generation", async () => {
    const res = await fetch(`${baseUrl}/api/pdf/1`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on users", async () => {
    const res = await fetch(`${baseUrl}/api/users`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on schools", async () => {
    const res = await fetch(`${baseUrl}/api/schools`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on reports summary", async () => {
    const res = await fetch(`${baseUrl}/api/reports/summary`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on reports removed-cards", async () => {
    const res = await fetch(`${baseUrl}/api/reports/removed-cards`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 403 on audit-logs", async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it("MARKETING_ADMIN gets 200 on GET /orders", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("MARKETING_ADMIN gets 200/201 on POST /orders", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        schoolId: testSchoolId,
        orderType: "STUDENT",
        className: "Class 10",
        section: "A",
        quantity: 50,
        hookType: "Lanyard hook",
        clip: true,
        printSides: "DOUBLE",
        cardMaterial: "PVC_PREMIUM",
        lanyardIncluded: true,
        lanyardColor: "Navy Blue",
        deliveryAddress: "123 Marketing Road",
        contactPerson: "Marketing Rep",
        contactPhone: "9876543210",
        notes: "Test marketing order",
      }),
    });
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
  });
});
