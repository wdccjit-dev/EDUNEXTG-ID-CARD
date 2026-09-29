import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "http";
import { and, eq, inArray } from "drizzle-orm";
import { apiRouter } from "./api";
import { hashPassword, loginUser } from "./appAuth";
import { getDb } from "./db";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardFiles,
  idCardTemplates,
  idCards,
  schools,
  users,
} from "../drizzle/schema";

describe("Delete school: confirmation summary, RBAC and full cascade", () => {
  let server: http.Server;
  let baseUrl = "";
  let adminToken = "";
  let adminUserId = 0;
  let templateId = 0;

  let schoolAId = 0;
  let schoolAToken = "";
  let schoolBId = 0;
  let cardAIds: number[] = [];
  let cardBId = 0;

  const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  async function createSchool(prefix: string) {
    const res = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        name: `${prefix} ${Date.now()}`,
        shortCode: `${prefix.slice(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`,
        email: `${prefix.toLowerCase()}_${Date.now()}@school.edu`,
      }),
    });
    expect(res.status).toBe(201);
    return res.json();
  }

  async function insertCard(schoolId: number, cardNumber: string) {
    const db = (await getDb())!;
    const [result] = await db.insert(idCards).values({
      schoolId,
      templateId,
      cardNumber,
      status: "DRAFT",
      submittedByUserId: adminUserId,
    });
    const id = Number(result.insertId);
    await db.insert(idCardData).values({ idCardId: id, fieldKey: "student_name", fieldValue: `Student ${cardNumber}` });
    await db.insert(idCardFiles).values({
      idCardId: id,
      fileType: "PHOTO",
      fileName: "photo.png",
      fileUrl: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      uploadedByUserId: adminUserId,
    });
    await db.insert(approvalHistory).values({
      idCardId: id,
      fromStatus: null,
      toStatus: "DRAFT",
      action: "CREATE_ID_CARD",
      actedByUserId: adminUserId,
    });
    return id;
  }

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required");

    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use("/api", apiRouter);
    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const adminEmail = `deleteadmin_${Date.now()}@edunextg.com`;
    const adminPass = "SuperSecureAdmin123!";
    const [adminRes] = await db.insert(users).values({
      openId: `delete_admin_${Date.now()}`,
      name: "Delete Test Super Admin",
      email: adminEmail,
      loginMethod: "local",
      passwordHash: await hashPassword(adminPass),
      role: "SUPER_ADMIN",
      isActive: true,
    });
    adminUserId = Number(adminRes.insertId);
    const login = await loginUser(adminEmail, adminPass);
    if (!login) throw new Error("Could not log in as Super Admin");
    adminToken = login.token;

    const tmplRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({ name: `Delete Test Template ${Date.now()}`, status: "ACTIVE", accent: "teal" }),
    });
    templateId = (await tmplRes.json()).id;

    const schoolA = await createSchool("Deleta");
    schoolAId = schoolA.id;
    const schoolB = await createSchool("Keeper");
    schoolBId = schoolB.id;

    const loginA = await loginUser(schoolA.credentials.loginId, schoolA.credentials.password);
    if (!loginA) throw new Error("Could not log in as School A");
    schoolAToken = loginA.token;

    cardAIds = [await insertCard(schoolAId, `DEL-A-1-${Date.now()}`), await insertCard(schoolAId, `DEL-A-2-${Date.now()}`)];
    cardBId = await insertCard(schoolBId, `DEL-B-1-${Date.now()}`);
  });

  afterAll(async () => {
    if (server) server.close();
    const db = await getDb();
    if (!db) return;
    const allCardIds = [...cardAIds, cardBId].filter(Boolean);
    if (allCardIds.length) {
      await db.delete(approvalHistory).where(inArray(approvalHistory.idCardId, allCardIds));
      await db.delete(idCardFiles).where(inArray(idCardFiles.idCardId, allCardIds));
      await db.delete(idCardData).where(inArray(idCardData.idCardId, allCardIds));
      await db.delete(idCards).where(inArray(idCards.id, allCardIds));
    }
    for (const sid of [schoolAId, schoolBId]) {
      if (!sid) continue;
      await db.delete(auditLogs).where(eq(auditLogs.schoolId, sid));
      await db.delete(users).where(eq(users.schoolId, sid));
      await db.delete(schools).where(eq(schools.id, sid));
    }
    await db.delete(auditLogs).where(and(eq(auditLogs.action, "DELETE_SCHOOL"), eq(auditLogs.entityId, schoolAId)));
    if (templateId) await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateId));
    if (adminUserId) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, adminUserId));
      await db.delete(users).where(eq(users.id, adminUserId));
    }
  });

  it("rejects a school admin deleting any school (403) and leaves data intact", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolBId}`, {
      method: "DELETE",
      headers: authHeaders(schoolAToken),
    });
    expect(res.status).toBe(403);
    const db = (await getDb())!;
    expect((await db.select().from(schools).where(eq(schools.id, schoolBId))).length).toBe(1);
  });

  it("rejects a school admin reading the deletion summary (403)", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolAId}/deletion-summary`, {
      headers: authHeaders(schoolAToken),
    });
    expect(res.status).toBe(403);
  });

  it("returns real counts in the deletion summary for a super admin", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolAId}/deletion-summary`, {
      headers: authHeaders(adminToken),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toBe(2);
    expect(body.users).toBeGreaterThanOrEqual(1);
    expect(typeof body.schoolName).toBe("string");
    expect(typeof body.shortCode).toBe("string");
  });

  it("returns 404 for unknown schools and 400 for invalid ids", async () => {
    const missing = await fetch(`${baseUrl}/api/schools/2147483000`, { method: "DELETE", headers: authHeaders(adminToken) });
    expect(missing.status).toBe(404);
    const missingSummary = await fetch(`${baseUrl}/api/schools/2147483000/deletion-summary`, { headers: authHeaders(adminToken) });
    expect(missingSummary.status).toBe(404);
    const invalid = await fetch(`${baseUrl}/api/schools/abc`, { method: "DELETE", headers: authHeaders(adminToken) });
    expect(invalid.status).toBe(400);
  });

  it("deletes the school with ALL its ID cards, files, data, history and users, and leaves other schools untouched", async () => {
    const db = (await getDb())!;
    const res = await fetch(`${baseUrl}/api/schools/${schoolAId}`, { method: "DELETE", headers: authHeaders(adminToken) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted.cards).toBe(2);

    expect((await db.select().from(schools).where(eq(schools.id, schoolAId))).length).toBe(0);
    expect((await db.select().from(idCards).where(eq(idCards.schoolId, schoolAId))).length).toBe(0);
    expect((await db.select().from(idCardData).where(inArray(idCardData.idCardId, cardAIds))).length).toBe(0);
    expect((await db.select().from(idCardFiles).where(inArray(idCardFiles.idCardId, cardAIds))).length).toBe(0);
    expect((await db.select().from(approvalHistory).where(inArray(approvalHistory.idCardId, cardAIds))).length).toBe(0);
    expect((await db.select().from(users).where(eq(users.schoolId, schoolAId))).length).toBe(0);

    // School B is untouched
    expect((await db.select().from(schools).where(eq(schools.id, schoolBId))).length).toBe(1);
    expect((await db.select().from(idCards).where(eq(idCards.id, cardBId))).length).toBe(1);
    expect((await db.select().from(idCardData).where(eq(idCardData.idCardId, cardBId))).length).toBe(1);
    expect((await db.select().from(idCardFiles).where(eq(idCardFiles.idCardId, cardBId))).length).toBe(1);
  });

  it("records a DELETE_SCHOOL audit entry with the school name and card count", async () => {
    const db = (await getDb())!;
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "DELETE_SCHOOL"), eq(auditLogs.entityId, schoolAId)));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const details = rows[rows.length - 1].newValues as { schoolName?: string; cards?: number } | null;
    expect(details?.cards).toBe(2);
    expect(typeof details?.schoolName).toBe("string");
  });
});
