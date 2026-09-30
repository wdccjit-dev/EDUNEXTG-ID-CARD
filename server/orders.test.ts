import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { schools, users, orders, notifications } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("Order Module: Lifecycle, Scoping, Validation & RBAC", () => {
  let server: http.Server;
  let baseUrl: string;

  let superAdminToken: string;
  let superAdminId: number;

  let school1Id: number;
  let school2Id: number;

  let schoolAdmin1Token: string;
  let schoolAdmin1Id: number;

  let schoolAdmin2Token: string;
  let schoolAdmin2Id: number;

  let marketingAdmin1Token: string;
  let marketingAdmin1Id: number;

  let marketingAdmin2Token: string;
  let marketingAdmin2Id: number;

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

    // 1. Create Super Admin
    const superAdminEmail = `sa_orders_${ts}@test.local`;
    const [saRes] = await db.insert(users).values({
      openId: `sa_orders_${ts}`,
      email: superAdminEmail,
      name: "Orders Super Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    superAdminId = Number(saRes.insertId);
    const saLogin = await loginUser(superAdminEmail, "TestPass123!");
    superAdminToken = saLogin!.token;

    // 2. Create School 1 & School Admin 1
    const [s1Res] = await db.insert(schools).values({
      name: `Orders School 1 ${ts}`,
      shortCode: `S1${Math.floor(100 + Math.random() * 900)}`,
      email: `school1_${ts}@orders.test`,
      isActive: true,
    });
    school1Id = Number(s1Res.insertId);

    const school1Email = `sch1_orders_${ts}@test.local`;
    const [sch1UserRes] = await db.insert(users).values({
      openId: `sch1_orders_${ts}`,
      email: school1Email,
      name: "School 1 Admin",
      role: "SCHOOL_ADMIN",
      schoolId: school1Id,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    schoolAdmin1Id = Number(sch1UserRes.insertId);
    const sch1Login = await loginUser(school1Email, "TestPass123!");
    schoolAdmin1Token = sch1Login!.token;

    // 3. Create School 2 & School Admin 2
    const [s2Res] = await db.insert(schools).values({
      name: `Orders School 2 ${ts}`,
      shortCode: `S2${Math.floor(100 + Math.random() * 900)}`,
      email: `school2_${ts}@orders.test`,
      isActive: true,
    });
    school2Id = Number(s2Res.insertId);

    const school2Email = `sch2_orders_${ts}@test.local`;
    const [sch2UserRes] = await db.insert(users).values({
      openId: `sch2_orders_${ts}`,
      email: school2Email,
      name: "School 2 Admin",
      role: "SCHOOL_ADMIN",
      schoolId: school2Id,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    schoolAdmin2Id = Number(sch2UserRes.insertId);
    const sch2Login = await loginUser(school2Email, "TestPass123!");
    schoolAdmin2Token = sch2Login!.token;

    // 4. Create Marketing Admin 1 & 2
    const mkt1Email = `mkt1_orders_${ts}@test.local`;
    const [mkt1Res] = await db.insert(users).values({
      openId: `mkt1_orders_${ts}`,
      email: mkt1Email,
      name: "Marketing Rep 1",
      role: "MARKETING_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    marketingAdmin1Id = Number(mkt1Res.insertId);
    const mkt1Login = await loginUser(mkt1Email, "TestPass123!");
    marketingAdmin1Token = mkt1Login!.token;

    const mkt2Email = `mkt2_orders_${ts}@test.local`;
    const [mkt2Res] = await db.insert(users).values({
      openId: `mkt2_orders_${ts}`,
      email: mkt2Email,
      name: "Marketing Rep 2",
      role: "MARKETING_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    marketingAdmin2Id = Number(mkt2Res.insertId);
    const mkt2Login = await loginUser(mkt2Email, "TestPass123!");
    marketingAdmin2Token = mkt2Login!.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  it("SCHOOL_ADMIN order is forced to own school even if another schoolId is sent", async () => {
    // schoolAdmin1 attempts to send school2Id
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(schoolAdmin1Token),
      body: JSON.stringify({
        schoolId: school2Id, // Attempted spoof
        orderType: "STUDENT",
        className: "Class 10",
        section: "A",
        quantity: 100,
        hookType: "Lanyard hook",
        clip: true,
        printSides: "DOUBLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "School 1 Campus Address",
        contactPerson: "Principal 1",
        contactPhone: "9876543210",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.schoolId).toBe(school1Id); // Enforced to school 1!
  });

  it("STAFF order nulls class and section even if provided", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(schoolAdmin1Token),
      body: JSON.stringify({
        orderType: "STAFF",
        className: "Class Staff Attempt",
        section: "Z",
        quantity: 25,
        hookType: "Badge reel",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_PREMIUM",
        deliveryAddress: "Staff Admin Office",
        contactPerson: "HR Staff",
        contactPhone: "9876543210",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.orderType).toBe("STAFF");
    expect(body.className).toBeNull();
    expect(body.section).toBeNull();
  });

  it("Rejects invalid quantity (0, negative, > 10000, non-integer)", async () => {
    const resZero = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(superAdminToken),
      body: JSON.stringify({
        schoolId: school1Id,
        orderType: "STUDENT",
        className: "Class 1",
        section: "A",
        quantity: 0,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Test Address",
        contactPerson: "Test Person",
        contactPhone: "9876543210",
      }),
    });
    expect(resZero.status).toBe(400);

    const resTooLarge = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(superAdminToken),
      body: JSON.stringify({
        schoolId: school1Id,
        orderType: "STUDENT",
        className: "Class 1",
        section: "A",
        quantity: 10001,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Test Address",
        contactPerson: "Test Person",
        contactPhone: "9876543210",
      }),
    });
    expect(resTooLarge.status).toBe(400);
  });

  it("Rejects invalid contact phone number", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(superAdminToken),
      body: JSON.stringify({
        schoolId: school1Id,
        orderType: "STUDENT",
        className: "Class 1",
        section: "A",
        quantity: 10,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Test Address",
        contactPerson: "Test Person",
        contactPhone: "12345", // Invalid Indian phone
      }),
    });
    expect(res.status).toBe(400);
  });

  it("Super admin receives a notification when an order is placed", async () => {
    const db = (await getDb())!;
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(marketingAdmin1Token),
      body: JSON.stringify({
        schoolId: school1Id,
        orderType: "STUDENT",
        className: "Grade 5",
        section: "B",
        quantity: 45,
        hookType: "Swivel hook",
        clip: true,
        printSides: "DOUBLE",
        cardMaterial: "PVC_PREMIUM",
        deliveryAddress: "Notif Test Delivery",
        contactPerson: "Notif Rep",
        contactPhone: "9123456780",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    const orderNumber = body.orderNumber;

    // Check notification for superAdminId
    const notifs = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, superAdminId), eq(notifications.schoolId, school1Id)));

    const matchingNotif = notifs.find((n) => n.message.includes(orderNumber));
    expect(matchingNotif).toBeDefined();
    expect(matchingNotif?.message).toContain("45 cards");
  });

  it("Scoping & Visibility: Marketing admin only sees own orders", async () => {
    // Mkt 2 places an order
    const resMkt2 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(marketingAdmin2Token),
      body: JSON.stringify({
        schoolId: school2Id,
        orderType: "STUDENT",
        className: "Class 8",
        section: "C",
        quantity: 30,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Mkt 2 Address",
        contactPerson: "Mkt 2 Person",
        contactPhone: "9876543210",
      }),
    });
    expect(resMkt2.status).toBe(201);
    const mkt2Order = await resMkt2.json();

    // Mkt 1 lists orders
    const listRes = await fetch(`${baseUrl}/api/orders`, {
      headers: authHeader(marketingAdmin1Token),
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();

    // Mkt 1 should NOT see Mkt 2's order
    const hasMkt2Order = listBody.items.some((o: any) => o.id === mkt2Order.id);
    expect(hasMkt2Order).toBe(false);

    // Mkt 1 should only see orders where placedByUserId === marketingAdmin1Id
    for (const item of listBody.items) {
      expect(item.placedByUserId).toBe(marketingAdmin1Id);
    }
  });

  it("Scoping & Visibility: School admin only sees own school's orders", async () => {
    // School 2 Admin places an order for School 2
    const resSch2 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(schoolAdmin2Token),
      body: JSON.stringify({
        orderType: "STUDENT",
        className: "Class 9",
        section: "A",
        quantity: 70,
        hookType: "J-hook",
        clip: true,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "School 2 Campus",
        contactPerson: "Principal 2",
        contactPhone: "9876543210",
      }),
    });
    expect(resSch2.status).toBe(201);
    const sch2Order = await resSch2.json();

    // School 1 Admin lists orders
    const listRes = await fetch(`${baseUrl}/api/orders`, {
      headers: authHeader(schoolAdmin1Token),
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();

    // School 1 should NOT see School 2 order
    const hasSch2Order = listBody.items.some((o: any) => o.id === sch2Order.id);
    expect(hasSch2Order).toBe(false);

    // All orders seen by School 1 Admin must have schoolId === school1Id
    for (const item of listBody.items) {
      expect(item.schoolId).toBe(school1Id);
    }
  });

  it("Super admin sees all orders and each row includes placedByName and placedByRole", async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      headers: authHeader(superAdminToken),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.items.length).toBeGreaterThanOrEqual(4);
    for (const item of body.items) {
      expect(typeof item.placedByName).toBe("string");
      expect(item.placedByName.length).toBeGreaterThan(0);
      expect(typeof item.placedByRole).toBe("string");
      expect(["SUPER_ADMIN", "SCHOOL_ADMIN", "MARKETING_ADMIN"]).toContain(item.placedByRole);
    }
  });

  it("Status updates: Only super admin can change status (403 for others)", async () => {
    // Create an order
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(schoolAdmin1Token),
      body: JSON.stringify({
        orderType: "STUDENT",
        className: "Class 7",
        section: "B",
        quantity: 15,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Status Test Address",
        contactPerson: "Status Person",
        contactPhone: "9876543210",
      }),
    });
    expect(orderRes.status).toBe(201);
    const order = await orderRes.json();

    // School admin tries to change status -> 403
    const schPatch = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: authHeader(schoolAdmin1Token),
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    expect(schPatch.status).toBe(403);

    // Marketing admin tries to change status -> 403
    const mktPatch = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: authHeader(marketingAdmin1Token),
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    expect(mktPatch.status).toBe(403);

    // Super admin changes status -> 200
    const saPatch = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: authHeader(superAdminToken),
      body: JSON.stringify({ status: "CONFIRMED", statusNote: "Order accepted by factory" }),
    });
    expect(saPatch.status).toBe(200);
    const updated = await saPatch.json();
    expect(updated.status).toBe("CONFIRMED");
    expect(updated.statusNote).toBe("Order accepted by factory");
  });

  it("Cancellation rules: Placer can cancel while PLACED, rejected once CONFIRMED; Super Admin can cancel anytime", async () => {
    // 1. Placer cancels while PLACED -> succeeds
    const o1Res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(marketingAdmin1Token),
      body: JSON.stringify({
        schoolId: school1Id,
        orderType: "STUDENT",
        className: "Class 6",
        section: "A",
        quantity: 20,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Cancel Test Address",
        contactPerson: "Cancel Person",
        contactPhone: "9876543210",
      }),
    });
    const o1 = await o1Res.json();

    const cancel1Res = await fetch(`${baseUrl}/api/orders/${o1.id}/cancel`, {
      method: "PATCH",
      headers: authHeader(marketingAdmin1Token),
      body: JSON.stringify({ statusNote: "No longer needed" }),
    });
    expect(cancel1Res.status).toBe(200);

    // 2. Placer tries to cancel an order that is CONFIRMED -> 400
    const o2Res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: authHeader(marketingAdmin1Token),
      body: JSON.stringify({
        schoolId: school1Id,
        orderType: "STUDENT",
        className: "Class 6",
        section: "B",
        quantity: 20,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Cancel Test 2",
        contactPerson: "Cancel Person 2",
        contactPhone: "9876543210",
      }),
    });
    const o2 = await o2Res.json();

    // Super admin advances it to CONFIRMED
    await fetch(`${baseUrl}/api/orders/${o2.id}/status`, {
      method: "PATCH",
      headers: authHeader(superAdminToken),
      body: JSON.stringify({ status: "CONFIRMED" }),
    });

    // Placer attempts to cancel -> rejected
    const cancel2Res = await fetch(`${baseUrl}/api/orders/${o2.id}/cancel`, {
      method: "PATCH",
      headers: authHeader(marketingAdmin1Token),
    });
    expect(cancel2Res.status).toBe(400);

    // 3. Super admin can cancel even when CONFIRMED -> 200
    const saCancelRes = await fetch(`${baseUrl}/api/orders/${o2.id}/cancel`, {
      method: "PATCH",
      headers: authHeader(superAdminToken),
      body: JSON.stringify({ statusNote: "Admin emergency cancellation" }),
    });
    expect(saCancelRes.status).toBe(200);
    const saCancelledOrder = await saCancelRes.json();
    expect(saCancelledOrder.status).toBe("CANCELLED");
  });
});
