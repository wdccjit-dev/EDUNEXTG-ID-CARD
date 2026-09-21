import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import {
  idCards,
  idCardData,
  idCardFiles,
  idCardRequests,
  approvalHistory,
  notifications,
  auditLogs,
  schools,
  users,
  idCardTemplates,
  templateElements,
  schoolTemplates,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("ID Card Management, Approval Workflow, PDF & Printing — 18 Scenarios", () => {
  let server: http.Server;
  let baseUrl: string;

  let schoolAId: number;
  let schoolBId: number;
  let templateId: number;

  let adminToken: string;
  let schoolAToken: string;
  let schoolBToken: string;

  let cardAId: number;
  let cardACardNumber: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required for test");

    // Start ephemeral test server
    const app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    // Clean up any stale records from interrupted prior runs
    const staleSchools = await db.select().from(schools).where(eq(schools.name, "Isolation School A"));
    for (const s of staleSchools) {
      await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, s.id));
      await db.delete(idCards).where(eq(idCards.schoolId, s.id));
      await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, s.id));
      await db.delete(users).where(eq(users.schoolId, s.id));
      await db.delete(schools).where(eq(schools.id, s.id));
    }
    const staleSchoolsB = await db.select().from(schools).where(eq(schools.name, "Isolation School B"));
    for (const s of staleSchoolsB) {
      await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, s.id));
      await db.delete(idCards).where(eq(idCards.schoolId, s.id));
      await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, s.id));
      await db.delete(users).where(eq(users.schoolId, s.id));
      await db.delete(schools).where(eq(schools.id, s.id));
    }

    const uniqueSuffix = Date.now().toString().slice(-4);
    const [resA] = await db.insert(schools).values({
      name: "Isolation School A",
      shortCode: `IA${uniqueSuffix}`,
      isActive: true,
    });
    schoolAId = Number(resA.insertId);

    const [resB] = await db.insert(schools).values({
      name: "Isolation School B",
      shortCode: `IB${uniqueSuffix}`,
      isActive: true,
    });
    schoolBId = Number(resB.insertId);

    // Create active template with required dynamic fields and photo
    const [tmplRes] = await db.insert(idCardTemplates).values({
      name: "Standard Student Card 2026",
      status: "ACTIVE",
      accent: "teal",
      cardWidth: 324,
      cardHeight: 204,
      orientation: "landscape",
    });
    templateId = Number(tmplRes.insertId);

    // Add dynamic field elements (student_name, admission_no, grade) and a photo element
    await db.insert(templateElements).values([
      {
        templateId,
        elementKey: "field_name",
        elementType: "DYNAMIC_FIELD",
        label: "Student Name",
        config: { x: 20, y: 30, width: 120, height: 25, dynamicField: "student_name", side: "FRONT" },
        sortOrder: 0,
      },
      {
        templateId,
        elementKey: "field_adm",
        elementType: "DYNAMIC_FIELD",
        label: "Admission No",
        config: { x: 20, y: 60, width: 100, height: 20, dynamicField: "admission_number", side: "FRONT" },
        sortOrder: 1,
      },
      {
        templateId,
        elementKey: "photo_1",
        elementType: "PHOTO",
        label: "Student Photo",
        config: { x: 220, y: 30, width: 80, height: 100, side: "FRONT" },
        sortOrder: 2,
      },
    ]);

    // Lock template for School A
    await db.insert(schoolTemplates).values({
      schoolId: schoolAId,
      templateId,
      isDefault: true,
      isLocked: true,
      lockedAt: new Date(),
    });

    // Create users: Super Admin, School A Admin, School B Admin
    const pwdHash = await hashPassword("TestPass123!");
    const ts = Date.now();
    const adminEmail = `admin_card_${ts}@test.local`;
    const schoolAEmail = `school_a_${ts}@test.local`;
    const schoolBEmail = `school_b_${ts}@test.local`;

    await db.insert(users).values([
      {
        openId: `admin_${ts}`,
        email: adminEmail,
        name: "Admin User",
        role: "SUPER_ADMIN",
        schoolId: null,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
      {
        openId: `school_a_${ts}`,
        email: schoolAEmail,
        name: "School A Admin",
        role: "SCHOOL_ADMIN",
        schoolId: schoolAId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
      {
        openId: `school_b_${ts}`,
        email: schoolBEmail,
        name: "School B Admin",
        role: "SCHOOL_ADMIN",
        schoolId: schoolBId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
    ]);

    const adminLogin = await loginUser(adminEmail, "TestPass123!");
    if (!adminLogin) throw new Error("Admin login failed in test setup");
    adminToken = adminLogin.token;

    const schoolALogin = await loginUser(schoolAEmail, "TestPass123!");
    if (!schoolALogin) throw new Error("School A login failed in test setup");
    schoolAToken = schoolALogin.token;

    const schoolBLogin = await loginUser(schoolBEmail, "TestPass123!");
    if (!schoolBLogin) throw new Error("School B login failed in test setup");
    schoolBToken = schoolBLogin.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db) {
      // Clean up test records
      if (schoolAId) {
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolAId));
        await db.delete(idCards).where(eq(idCards.schoolId, schoolAId));
        await db.delete(notifications).where(eq(notifications.schoolId, schoolAId));
        await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolAId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolAId));
        await db.delete(users).where(eq(users.schoolId, schoolAId));
        await db.delete(schools).where(eq(schools.id, schoolAId));
      }
      if (schoolBId) {
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolBId));
        await db.delete(idCards).where(eq(idCards.schoolId, schoolBId));
        await db.delete(notifications).where(eq(notifications.schoolId, schoolBId));
        await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolBId));
        await db.delete(users).where(eq(users.schoolId, schoolBId));
        await db.delete(schools).where(eq(schools.id, schoolBId));
      }
      if (templateId) {
        await db.delete(templateElements).where(eq(templateElements.templateId, templateId));
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateId));
      }
    }
  });

  // 1. Create draft
  it("Scenario 1: Admin creates draft card for school with generated card number and DRAFT status", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        templateId,
        data: {
          student_name: "Alice Johnson",
          admission_number: "ADM-2026-001",
          grade: "10-A",
          photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe("DRAFT");
    expect(body.schoolId).toBe(schoolAId);
    expect(body.cardNumber).toMatch(/^IDC-\d{4}-\d{6}$/);

    cardAId = body.id;
    cardACardNumber = body.cardNumber;
  });

  // 2. Edit draft
  it("Scenario 2: Admin edits draft card details", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          student_name: "Alice M. Johnson",
          emergency_phone: "+1-555-0199",
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // 3. Save dynamic fields
  it("Scenario 3: Save dynamic fields and verify persistence in id_card_data", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.id).toBe(cardAId);
    expect(detail.dataMap.student_name).toBe("Alice M. Johnson");
    expect(detail.dataMap.admission_number).toBe("ADM-2026-001");
    expect(detail.dataMap.emergency_phone).toBe("+1-555-0199");
  });

  // 4. Submit card
  it("Scenario 4: Admin submits card for school approval transitions status to SUBMITTED", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentName: "Alice M. Johnson",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("SUBMITTED");

    // Verify card is now SUBMITTED in database
    const cardRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    const card = await cardRes.json();
    expect(card.status).toBe("SUBMITTED");
  });

  // 5. Invalid submission rejected
  it("Scenario 5: Invalid submission missing required template fields is rejected with 400", async () => {
    // Create an incomplete card missing admission_number and photo
    const createRes = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        templateId,
        data: {
          student_name: "Incomplete Student",
          // missing admission_number and photo
        },
      }),
    });
    const incomplete = await createRes.json();

    const submitRes = await fetch(`${baseUrl}/api/id-cards/${incomplete.id}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(submitRes.status).toBe(400);
    const err = await submitRes.json();
    expect(err.error).toMatch(/Missing required template field|photo is required/i);
  });

  // 6. School sees submitted card
  it("Scenario 6: School sees submitted card in their queue for review", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.status).toBe("SUBMITTED");
    expect(card.cardNumber).toBe(cardACardNumber);
  });

  // 7. Request changes
  it("Scenario 7: School requests changes with mandatory comment, status becomes CHANGES_REQUIRED", async () => {
    // Missing comment should fail
    const failRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/request-changes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: "" }),
    });
    expect(failRes.status).toBe(400);

    // Valid comment succeeds
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/request-changes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: "Student name spelling should be verified against birth cert" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CHANGES_REQUIRED");
  });

  // 8. School & Admin see change request
  it("Scenario 8: Admin and School see CHANGES_REQUIRED status and comment in audit timeline", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.status).toBe("CHANGES_REQUIRED");
    expect(card.approvalHistory.length).toBeGreaterThanOrEqual(2);

    const changeRequestHistory = card.approvalHistory.find(
      (h: any) => h.toStatus === "CHANGES_REQUIRED",
    );
    expect(changeRequestHistory).toBeDefined();
    expect(changeRequestHistory.comments).toContain("birth cert");
  });

  // 9. Admin updates and resubmits
  it("Scenario 9: Admin updates corrections and resubmits, transitioning to RESUBMITTED", async () => {
    // Admin edits card
    const editRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          student_name: "Alice Marie Johnson",
        },
      }),
    });
    expect(editRes.status).toBe(200);

    // Admin resubmits
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("RESUBMITTED");
  });

  // 10. School approves
  it("Scenario 10: School approves resubmitted card, transitioning status to APPROVED", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
  });

  // 11. School cannot edit or delete cards
  it("Scenario 11: School attempts to edit or delete cards are rejected with 403 Forbidden", async () => {
    // Edit attempt
    const editRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { student_name: "Hacked Name" },
      }),
    });
    expect(editRes.status).toBe(403);

    // Delete attempt
    const deleteRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
      },
    });
    expect(deleteRes.status).toBe(403);
  });

  // 12. PDF generation
  it("Scenario 12: Admin can download PDF while School is rejected with 403 Forbidden", async () => {
    // School attempt rejected with 403
    const schoolRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/pdf`, {
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
      },
    });
    expect(schoolRes.status).toBe(403);

    // Admin attempt succeeds with 200
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/pdf`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(500);

    // Bulk PDF generation
    const bulkRes = await fetch(`${baseUrl}/api/id-cards/bulk-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cardIds: [cardAId] }),
    });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.headers.get("content-type")).toContain("application/pdf");
  });

  // 13. Printing
  it("Scenario 13: Admin printing transitions card status from APPROVED to PRINTED; School print is rejected with 403", async () => {
    // School attempt rejected with 403
    const schoolPrintRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/print`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(schoolPrintRes.status).toBe(403);

    // Admin attempt succeeds
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/print`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PRINTED");

    // Verify status in DB
    const cardRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    const card = await cardRes.json();
    expect(card.status).toBe("PRINTED");
  });

  // 14. Audit log creation
  it("Scenario 14: Audit logs record each lifecycle step with action and actor", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB missing");

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.schoolId, schoolAId));
    expect(logs.length).toBeGreaterThanOrEqual(4);

    const actions = logs.map((l) => l.action);
    expect(actions).toContain("CREATE_ID_CARD");
    expect(actions).toContain("SUBMIT_ID_CARD");
    expect(actions).toContain("REQUEST_CHANGES");
    expect(actions).toContain("APPROVE_ID_CARD");
    expect(actions).toContain("PRINT_ID_CARD");
  });

  // 15. Notification creation
  it("Scenario 15: Notifications created for both School users and Super Admins", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB missing");

    const notifs = await db.select().from(notifications).where(eq(notifications.schoolId, schoolAId));
    expect(notifs.length).toBeGreaterThan(0);

    const titles = notifs.map((n) => n.title);
    expect(titles.some((t) => t.toLowerCase().includes("submitted") || t.toLowerCase().includes("approved"))).toBe(true);
  });

  // 16. School A cannot access School B
  it("Scenario 16: School B user cannot access, edit, submit, or delete School A's card", async () => {
    // Read attempt
    const readRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(readRes.status).toBe(403);

    // Edit attempt
    const editRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolBToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { student_name: "Illicit Edit" } }),
    });
    expect(editRes.status).toBe(403);

    // Submit attempt
    const submitRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolBToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(submitRes.status).toBe(403);

    // Delete attempt
    const delRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(delRes.status).toBe(403);
  });

  // 17. School user cannot create ID cards
  it("Scenario 17: School user cannot create ID cards (rejected with 403 Forbidden)", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        templateId,
        data: {
          student_name: "School Attempt",
        },
      }),
    });

    expect(res.status).toBe(403);
  });

  // 18. Invalid status transitions rejected
  it("Scenario 18: Invalid status transitions are rejected with 400", async () => {
    // Admin creates new draft
    const draftRes = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        templateId,
        data: { student_name: "Premature Approval" },
      }),
    });
    const draft = await draftRes.json();

    // 1. Cannot directly approve DRAFT
    const badApprove = await fetch(`${baseUrl}/api/id-cards/${draft.id}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(badApprove.status).toBe(400);

    // 2. Cannot directly print DRAFT
    const badPrint = await fetch(`${baseUrl}/api/id-cards/${draft.id}/print`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(badPrint.status).toBe(400);
  });
});
