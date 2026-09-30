import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import {
  schools,
  users,
  orders,
  removedCardsHistory,
  idCards,
  idCardTemplates,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("School Deletion: Cascade & Summary Counts for Orders and Removed Cards", () => {
  let server: http.Server;
  let baseUrl: string;
  let superAdminToken: string;
  let superAdminId: number;

  let schoolToDeleteId: number;
  let schoolKeepId: number;

  let templateId: number;
  let cardId: number;

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

    // Super Admin
    const saEmail = `sa_schdel_${ts}@test.local`;
    const [saRes] = await db.insert(users).values({
      openId: `sa_schdel_${ts}`,
      email: saEmail,
      name: "Deletion Test Super Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    superAdminId = Number(saRes.insertId);
    const saLogin = await loginUser(saEmail, "TestPass123!");
    superAdminToken = saLogin!.token;

    // School to delete
    const [sDelRes] = await db.insert(schools).values({
      name: `School To Delete ${ts}`,
      shortCode: `SD${Math.floor(100 + Math.random() * 900)}`,
      email: `del_${ts}@school.test`,
      isActive: true,
    });
    schoolToDeleteId = Number(sDelRes.insertId);

    // School to keep
    const [sKeepRes] = await db.insert(schools).values({
      name: `School To Keep ${ts}`,
      shortCode: `SK${Math.floor(100 + Math.random() * 900)}`,
      email: `keep_${ts}@school.test`,
      isActive: true,
    });
    schoolKeepId = Number(sKeepRes.insertId);

    // Template
    const [tRes] = await db.insert(idCardTemplates).values({
      name: `Template ${ts}`,
      orientation: "landscape",
      cardWidth: 324,
      cardHeight: 204,
      status: "ACTIVE",
    });
    templateId = Number(tRes.insertId);

    // Cards
    const [cRes] = await db.insert(idCards).values({
      schoolId: schoolToDeleteId,
      templateId,
      cardNumber: `CARD-DEL-${ts}`,
      status: "APPROVED",
      submittedByUserId: superAdminId,
    });
    cardId = Number(cRes.insertId);

    // Orders for schoolToDelete (2 orders)
    await db.insert(orders).values([
      {
        orderNumber: `ORD-DEL1-${ts}`,
        schoolId: schoolToDeleteId,
        placedByUserId: superAdminId,
        placedByRole: "SUPER_ADMIN",
        placedByName: "Deletion Admin",
        orderType: "STUDENT",
        className: "10",
        section: "A",
        quantity: 50,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Address 1",
        contactPerson: "Contact 1",
        contactPhone: "9876543210",
        status: "PLACED",
      },
      {
        orderNumber: `ORD-DEL2-${ts}`,
        schoolId: schoolToDeleteId,
        placedByUserId: superAdminId,
        placedByRole: "SUPER_ADMIN",
        placedByName: "Deletion Admin",
        orderType: "STAFF",
        quantity: 10,
        hookType: "None",
        clip: false,
        printSides: "SINGLE",
        cardMaterial: "PVC_STANDARD",
        deliveryAddress: "Address 2",
        contactPerson: "Contact 2",
        contactPhone: "9876543210",
        status: "PLACED",
      },
    ]);

    // Order for schoolToKeep
    await db.insert(orders).values({
      orderNumber: `ORD-KEEP-${ts}`,
      schoolId: schoolKeepId,
      placedByUserId: superAdminId,
      placedByRole: "SUPER_ADMIN",
      placedByName: "Deletion Admin",
      orderType: "STUDENT",
      className: "9",
      section: "B",
      quantity: 30,
      hookType: "None",
      clip: false,
      printSides: "SINGLE",
      cardMaterial: "PVC_STANDARD",
      deliveryAddress: "Keep Address",
      contactPerson: "Keep Contact",
      contactPhone: "9876543210",
      status: "PLACED",
    });

    // Removed cards history for schoolToDelete (1 record)
    await db.insert(removedCardsHistory).values({
      idCardId: cardId,
      schoolId: schoolToDeleteId,
      cardNumber: `CARD-DEL-${ts}`,
      studentName: "John Doe",
      className: "10",
      section: "A",
      templateName: "Template",
      previousStatus: "APPROVED",
      removedByUserId: superAdminId,
      removedByName: "Deletion Admin",
      removedByRole: "SUPER_ADMIN",
    });

    const [cKeepRes] = await db.insert(idCards).values({
      schoolId: schoolKeepId,
      templateId,
      cardNumber: `CARD-KEEP-${ts}`,
      status: "APPROVED",
      submittedByUserId: superAdminId,
    });
    const cardKeepId = Number(cKeepRes.insertId);

    // Removed cards history for schoolToKeep (1 record)
    await db.insert(removedCardsHistory).values({
      idCardId: cardKeepId,
      schoolId: schoolKeepId,
      cardNumber: `CARD-KEEP-${ts}`,
      studentName: "Jane Doe",
      className: "11",
      section: "A",
      templateName: "Template",
      previousStatus: "APPROVED",
      removedByUserId: superAdminId,
      removedByName: "Deletion Admin",
      removedByRole: "SUPER_ADMIN",
    });
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

  it("Deletion summary endpoint includes orders and removedCards counts", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolToDeleteId}/deletion-summary`, {
      headers: authHeader(),
    });

    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary.orders).toBe(2);
    expect(summary.removedCards).toBe(1);
    expect(summary.cards).toBeGreaterThanOrEqual(1);
  });

  it("Deleting the school cascades and deletes associated orders and removed_cards_history", async () => {
    const db = (await getDb())!;

    const delRes = await fetch(`${baseUrl}/api/schools/${schoolToDeleteId}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    expect(delRes.status).toBe(200);

    // Verify deleted school is gone
    const schoolInDb = (await db.select().from(schools).where(eq(schools.id, schoolToDeleteId)))[0];
    expect(schoolInDb).toBeUndefined();

    // Verify orders for deleted school are deleted
    const ordersForDelSchool = await db.select().from(orders).where(eq(orders.schoolId, schoolToDeleteId));
    expect(ordersForDelSchool.length).toBe(0);

    // Verify removed cards history for deleted school are deleted
    const historyForDelSchool = await db
      .select()
      .from(removedCardsHistory)
      .where(eq(removedCardsHistory.schoolId, schoolToDeleteId));
    expect(historyForDelSchool.length).toBe(0);

    // Verify other school's orders and history remain intact
    const ordersForKeepSchool = await db.select().from(orders).where(eq(orders.schoolId, schoolKeepId));
    expect(ordersForKeepSchool.length).toBe(1);

    const historyForKeepSchool = await db
      .select()
      .from(removedCardsHistory)
      .where(eq(removedCardsHistory.schoolId, schoolKeepId));
    expect(historyForKeepSchool.length).toBe(1);
  });
});
