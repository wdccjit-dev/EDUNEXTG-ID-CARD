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
  idCardTemplates,
  idCards,
  idCardData,
  removedCardsHistory,
  auditLogs,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("Approved Card Removal & Reports History", () => {
  let server: http.Server;
  let baseUrl: string;

  let superAdminToken: string;
  let superAdminId: number;

  let schoolAToken: string;
  let schoolAId: number;

  let schoolBId: number;

  let templateId: number;

  let card1Id: number; // Approved, School A
  let card2Id: number; // Printed, School A
  let card3Id: number; // Draft, School A
  let card4Id: number; // Approved, School B

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
    const saEmail = `sa_rem_${ts}@test.local`;
    const [saRes] = await db.insert(users).values({
      openId: `sa_rem_${ts}`,
      email: saEmail,
      name: "Removal Super Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    superAdminId = Number(saRes.insertId);
    const saLogin = await loginUser(saEmail, "TestPass123!");
    superAdminToken = saLogin!.token;

    // School A
    const [sARes] = await db.insert(schools).values({
      name: `Removal School A ${ts}`,
      shortCode: `RA${Math.floor(100 + Math.random() * 900)}`,
      email: `schoolA_${ts}@rem.test`,
      isActive: true,
    });
    schoolAId = Number(sARes.insertId);

    const sAEmail = `schA_rem_${ts}@test.local`;
    await db.insert(users).values({
      openId: `schA_rem_${ts}`,
      email: sAEmail,
      name: "School A Admin",
      role: "SCHOOL_ADMIN",
      schoolId: schoolAId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const sALogin = await loginUser(sAEmail, "TestPass123!");
    schoolAToken = sALogin!.token;

    // School B
    const [sBRes] = await db.insert(schools).values({
      name: `Removal School B ${ts}`,
      shortCode: `RB${Math.floor(100 + Math.random() * 900)}`,
      email: `schoolB_${ts}@rem.test`,
      isActive: true,
    });
    schoolBId = Number(sBRes.insertId);

    // Template
    const [tmplRes] = await db.insert(idCardTemplates).values({
      name: `Removal Test Template ${ts}`,
      orientation: "landscape",
      cardWidth: 324,
      cardHeight: 204,
      status: "ACTIVE",
    });
    templateId = Number(tmplRes.insertId);

    // Helper to create card with data
    const createCard = async (
      schoolId: number,
      cardNumber: string,
      status: "APPROVED" | "PRINTED" | "DRAFT",
      studentName: string,
      className: string,
      section: string,
    ) => {
      const [cRes] = await db.insert(idCards).values({
        schoolId,
        templateId,
        cardNumber,
        status,
        submittedByUserId: superAdminId,
      });
      const cid = Number(cRes.insertId);
      await db.insert(idCardData).values([
        { idCardId: cid, fieldKey: "student_name", fieldValue: studentName },
        { idCardId: cid, fieldKey: "class_name", fieldValue: className },
        { idCardId: cid, fieldKey: "section", fieldValue: section },
      ]);
      return cid;
    };

    card1Id = await createCard(schoolAId, `CRD-${ts}-01`, "APPROVED", "Alice Green", "Class 10", "A");
    card2Id = await createCard(schoolAId, `CRD-${ts}-02`, "PRINTED", "Bob White", "Class 10", "B");
    card3Id = await createCard(schoolAId, `CRD-${ts}-03`, "DRAFT", "Charlie Brown", "Class 9", "A");
    card4Id = await createCard(schoolBId, `CRD-${ts}-04`, "APPROVED", "David Black", "Class 10", "A");
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

  it("Cross-school card IDs return 403 for SCHOOL_ADMIN", async () => {
    // School Admin A attempts to remove card1 (own) and card4 (School B)
    const res = await fetch(`${baseUrl}/api/id-cards/bulk-remove-approved`, {
      method: "POST",
      headers: authHeader(schoolAToken),
      body: JSON.stringify({ cardIds: [card1Id, card4Id] }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Cross-school card removal is forbidden");
  });

  it("Bulk remove skips non-approved cards and soft-removes eligible cards in one transaction", async () => {
    // Card 1 is APPROVED, Card 2 is PRINTED, Card 3 is DRAFT
    const res = await fetch(`${baseUrl}/api/id-cards/bulk-remove-approved`, {
      method: "POST",
      headers: authHeader(schoolAToken),
      body: JSON.stringify({ cardIds: [card1Id, card2Id, card3Id] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.removedCount).toBe(2);
    expect(body.skippedCount).toBe(1); // card3 was skipped
    expect(body.removedIds).toContain(card1Id);
    expect(body.removedIds).toContain(card2Id);
    expect(body.removedIds).not.toContain(card3Id);
  });

  it("Removed cards are snapshotted into removed_cards_history with class and section text", async () => {
    const db = (await getDb())!;
    const history1 = (await db.select().from(removedCardsHistory).where(eq(removedCardsHistory.idCardId, card1Id)))[0];
    expect(history1).toBeDefined();
    expect(history1.studentName).toBe("Alice Green");
    expect(history1.className).toBe("Class 10");
    expect(history1.section).toBe("A");
    expect(history1.previousStatus).toBe("APPROVED");

    const history2 = (await db.select().from(removedCardsHistory).where(eq(removedCardsHistory.idCardId, card2Id)))[0];
    expect(history2).toBeDefined();
    expect(history2.studentName).toBe("Bob White");
    expect(history2.className).toBe("Class 10");
    expect(history2.section).toBe("B");
    expect(history2.previousStatus).toBe("PRINTED");
  });

  it("Removed cards vanish from Approved cards list, print, and PDF", async () => {
    // 1. Vanish from Approved list
    const listRes = await fetch(`${baseUrl}/api/id-cards?status=APPROVED`, {
      headers: authHeader(superAdminToken),
    });
    const listBody = await listRes.json();
    const approvedCards = Array.isArray(listBody) ? listBody : (listBody.items || []);
    const approvedIds = approvedCards.map((c: any) => c.id);
    expect(approvedIds).not.toContain(card1Id);
    expect(approvedIds).not.toContain(card2Id);

    // 2. Vanish from PDF endpoint
    const pdfRes = await fetch(`${baseUrl}/api/id-cards/${card1Id}/pdf`, {
      headers: authHeader(superAdminToken),
    });
    expect(pdfRes.status).toBe(404);

    // 3. Vanish from Print endpoint
    const printRes = await fetch(`${baseUrl}/api/id-cards/${card1Id}/print`, {
      method: "POST",
      headers: authHeader(superAdminToken),
    });
    expect([403, 404]).toContain(printRes.status);
  });

  it("Exactly one audit log entry is written for the bulk removal", async () => {
    const db = (await getDb())!;
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "REMOVE_APPROVED_CARDS"), eq(auditLogs.schoolId, schoolAId)));

    expect(logs.length).toBe(1);
    const newVals = logs[0].newValues as any;
    expect(newVals.count).toBe(2);
    expect(newVals.skippedCount).toBe(1);
  });

  it("Reports endpoint paginates and filters by class and section", async () => {
    // Filter by Class 10 & Section A -> only Alice
    const resA = await fetch(
      `${baseUrl}/api/reports/removed-cards?schoolId=${schoolAId}&className=Class 10&section=A`,
      { headers: authHeader(superAdminToken) },
    );
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.total).toBe(1);
    expect(bodyA.items[0].studentName).toBe("Alice Green");
    expect(bodyA.items[0].section).toBe("A");

    // Filter by Class 10 -> both Alice & Bob
    const resAllClass10 = await fetch(
      `${baseUrl}/api/reports/removed-cards?schoolId=${schoolAId}&className=Class 10`,
      { headers: authHeader(superAdminToken) },
    );
    expect(resAllClass10.status).toBe(200);
    const bodyAllClass10 = await resAllClass10.json();
    expect(bodyAllClass10.total).toBe(2);

    // Pagination test
    const page1Res = await fetch(
      `${baseUrl}/api/reports/removed-cards?schoolId=${schoolAId}&page=1&pageSize=1`,
      { headers: authHeader(superAdminToken) },
    );
    expect(page1Res.status).toBe(200);
    const page1Body = await page1Res.json();
    expect(page1Body.items.length).toBe(1);
    expect(page1Body.total).toBe(2);
    expect(page1Body.page).toBe(1);
    expect(page1Body.pageSize).toBe(1);
  });
});
