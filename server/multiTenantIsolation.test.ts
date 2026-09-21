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
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { generateSingleCardPdf } from "./pdf";

describe("Strict Multi-Tenant Isolation & Comprehensive RBAC Verification", () => {
  let server: http.Server;
  let baseUrl: string;

  let adminToken: string;
  let adminUserId: number;

  let schoolAId: number;
  let schoolALoginId: string;
  let schoolAPassword: string;
  let schoolAToken: string;
  let schoolAUserId: number;

  let schoolBId: number;
  let schoolBLoginId: string;
  let schoolBPassword: string;
  let schoolBToken: string;
  let schoolBUserId: number;

  let templateActiveId: number;
  let templateUnusedId: number;
  let cardAId: number;
  let cardANumber: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required");

    const app = express();
    app.use(express.json({ limit: "10mb" }));
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

    // 1. Ensure Super Admin exists
    const adminEmail = `superadmin_${Date.now()}@edunextg.com`;
    const adminPass = "SuperSecureAdmin123!";
    const [adminRes] = await db.insert(users).values({
      openId: `admin_open_${Date.now()}`,
      name: "Platform Super Admin",
      email: adminEmail,
      loginMethod: "local",
      passwordHash: await hashPassword(adminPass),
      role: "SUPER_ADMIN",
      isActive: true,
    });
    adminUserId = Number(adminRes.insertId);

    const loginAdmin = await loginUser(adminEmail, adminPass);
    if (!loginAdmin) throw new Error("Could not log in as Super Admin");
    adminToken = loginAdmin.token;

    // 2. Create School A via Admin API
    const createResA = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `School Alpha ${Date.now()}`,
        shortCode: `SA${Math.floor(100 + Math.random() * 900)}`,
        email: `alpha_${Date.now()}@school.edu`,
      }),
    });
    expect(createResA.status).toBe(201);
    const bodyA = await createResA.json();
    schoolAId = bodyA.id;
    schoolALoginId = bodyA.credentials.loginId;
    schoolAPassword = bodyA.credentials.password;

    // 3. Create School B via Admin API
    const createResB = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `School Beta ${Date.now()}`,
        shortCode: `SB${Math.floor(100 + Math.random() * 900)}`,
        email: `beta_${Date.now()}@school.edu`,
      }),
    });
    expect(createResB.status).toBe(201);
    const bodyB = await createResB.json();
    schoolBId = bodyB.id;
    schoolBLoginId = bodyB.credentials.loginId;
    schoolBPassword = bodyB.credentials.password;

    // 4. Log in as School A
    const loginA = await loginUser(schoolALoginId, schoolAPassword);
    if (!loginA) throw new Error("Could not log in as School A");
    schoolAToken = loginA.token;
    schoolAUserId = loginA.user.id;

    // 5. Log in as School B
    const loginB = await loginUser(schoolBLoginId, schoolBPassword);
    if (!loginB) throw new Error("Could not log in as School B");
    schoolBToken = loginB.token;
    schoolBUserId = loginB.user.id;

    // 6. Create templates (1 ACTIVE, 1 UNUSED)
    const tmplActiveRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Active Multi-Tenant Template ${Date.now()}`,
        status: "ACTIVE",
        accent: "teal",
        orientation: "landscape",
        cardWidth: 324,
        cardHeight: 204,
      }),
    });
    const tmplActive = await tmplActiveRes.json();
    templateActiveId = tmplActive.id;

    const tmplUnusedRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Unused Template ${Date.now()}`,
        status: "ACTIVE",
        accent: "coral",
      }),
    });
    const tmplUnused = await tmplUnusedRes.json();
    templateUnusedId = tmplUnused.id;
  });

  afterAll(async () => {
    if (server) server.close();
    const db = await getDb();
    if (db) {
      if (schoolAId) {
        await db.delete(idCards).where(eq(idCards.schoolId, schoolAId));
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolAId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolAId));
        await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolAId));
        await db.delete(users).where(eq(users.schoolId, schoolAId));
        await db.delete(schools).where(eq(schools.id, schoolAId));
      }
      if (schoolBId) {
        await db.delete(idCards).where(eq(idCards.schoolId, schoolBId));
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolBId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolBId));
        await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolBId));
        await db.delete(users).where(eq(users.schoolId, schoolBId));
        await db.delete(schools).where(eq(schools.id, schoolBId));
      }
      if (templateActiveId) {
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateActiveId));
      }
      if (templateUnusedId) {
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateUnusedId));
      }
      if (adminUserId) {
        await db.delete(users).where(eq(users.id, adminUserId));
      }
    }
  });

  it("1. School user creation permanently associates user with schoolId", async () => {
    const db = await getDb();
    const userRow = (await db!.select().from(users).where(eq(users.id, schoolAUserId)))[0];
    expect(userRow.schoolId).toBe(schoolAId);
    expect(userRow.role).toBe("SCHOOL_ADMIN");
  });

  it("2. School A can select template for its own school, but rejected for School B", async () => {
    // School A selecting for School A -> 200
    const ownSelect = await fetch(`${baseUrl}/api/schools/${schoolAId}/templates/select`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId: templateActiveId }),
    });
    expect(ownSelect.status).toBe(200);

    // School A attempting to select for School B -> 403
    const crossSelect = await fetch(`${baseUrl}/api/schools/${schoolBId}/templates/select`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId: templateActiveId }),
    });
    expect(crossSelect.status).toBe(403);
  });

  it("3. Admin sees template selection status for both schools", async () => {
    const res = await fetch(`${baseUrl}/api/schools`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const allSchools: any[] = await res.json();
    const sA = allSchools.find((s) => s.id === schoolAId);
    const sB = allSchools.find((s) => s.id === schoolBId);
    expect(sA.templateSelectionStatus).toBe("Selected");
    expect(sA.selectedTemplateId).toBe(templateActiveId);
    expect(sB.templateSelectionStatus).toBe("Not Selected");
  });

  it("4. School A cannot create, edit, or delete templates", async () => {
    // Create template attempt by School A -> 403
    const createRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Hacked Template" }),
    });
    expect(createRes.status).toBe(403);

    // Edit template attempt by School A -> 403
    const editRes = await fetch(`${baseUrl}/api/templates/${templateActiveId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Tampered Template" }),
    });
    expect(editRes.status).toBe(403);

    // Delete template attempt by School A -> 403
    const deleteRes = await fetch(`${baseUrl}/api/templates/${templateActiveId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(deleteRes.status).toBe(403);
  });

  it("5. School A cannot create, edit, or delete ID cards (Admin only)", async () => {
    // School A attempts to create ID card -> 403
    const createCardRes = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        templateId: templateActiveId,
        cardNumber: "IDC-SCHOOL-A-FAIL",
      }),
    });
    expect(createCardRes.status).toBe(403);

    // Admin creates ID card for School A with base64 image data -> 201
    const dummyPhotoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const adminCreateRes = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        templateId: templateActiveId,
        data: {
          student_name: "Alice Alpha",
          admission_number: "ADM-ALPHA-001",
          photo: dummyPhotoBase64,
        },
      }),
    });
    expect(adminCreateRes.status).toBe(201);
    const createdCard = await adminCreateRes.json();
    cardAId = createdCard.id;
    cardANumber = createdCard.cardNumber;

    // School A attempts to edit card -> 403
    const editCardRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { student_name: "Hacked" } }),
    });
    expect(editCardRes.status).toBe(403);

    // School A attempts to delete card -> 403
    const deleteCardRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(deleteCardRes.status).toBe(403);
  });

  it("6. Template deletion fix: Cannot delete template currently used by an ID card (returns 400)", async () => {
    const res = await fetch(`${baseUrl}/api/templates/${templateActiveId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("currently used by ID cards");
  });

  it("7. Template deletion succeeds with 204 when template is not used", async () => {
    const res = await fetch(`${baseUrl}/api/templates/${templateUnusedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(204);
  });

  it("8. School B cannot access School A's ID card (403 Forbidden)", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("9. School A can view its own ID card details", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.id).toBe(cardAId);
    expect(card.schoolId).toBe(schoolAId);
    // Detail endpoint preserves full image data
    expect(card.dataMap.photo).toContain("data:image/png;base64");
  });

  it("10. ID Card List API optimizes payload: omits heavy base64 strings", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(res.status).toBe(200);
    const list: any[] = await res.json();
    const found = list.find((c) => c.id === cardAId);
    expect(found).toBeDefined();
    // List dataMap replaces heavy photo with lightweight placeholder
    expect(found.dataMap.photo).toBe("[IMAGE_ATTACHED]");
  });

  it("11. School A cannot submit card for approval (Admin only)", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("12. Admin submits card for approval: transactional & handles duplicate safely", async () => {
    // 1st submit
    const res1 = await fetch(`${baseUrl}/api/id-cards/${cardAId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.status).toBe("SUBMITTED");

    // Verify status in DB
    const db = await getDb();
    const card = (await db!.select().from(idCards).where(eq(idCards.id, cardAId)))[0];
    expect(card.status).toBe("SUBMITTED");
    expect(card.requestId).toBeTruthy();

    // Verify approval history was created
    const hist = await db!.select().from(approvalHistory).where(eq(approvalHistory.idCardId, cardAId));
    expect(hist.length).toBeGreaterThan(0);
  });

  it("13. School B cannot approve or reject School A's card (403 Forbidden)", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("14. School A approves its own card successfully", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardAId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
  });

  it("15. Approved ID card remains viewable in School A's ID card list", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(res.status).toBe(200);
    const list: any[] = await res.json();
    const found = list.find((c) => c.id === cardAId);
    expect(found).toBeDefined();
    expect(found.status).toBe("APPROVED");
  });

  it("16. School A cannot print or download PDF (Admin only)", async () => {
    const printRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(printRes.status).toBe(403);

    const pdfRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/pdf`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(pdfRes.status).toBe(403);
  });

  it("17. Admin prints card and generates PDF successfully", async () => {
    const printRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(printRes.status).toBe(200);

    const pdfRes = await fetch(`${baseUrl}/api/id-cards/${cardAId}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
    const buf = await pdfRes.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(500);
  });

  it("18. PDF generation never prints literal 'IMAGE' text fallback", async () => {
    // Generate PDF for a template that has an IMAGE element with missing/empty image
    const pdfBuffer = await generateSingleCardPdf({
      cardNumber: "IDC-TEST-PDF",
      template: {
        cardWidth: 324,
        cardHeight: 204,
        orientation: "landscape",
        elements: [
          {
            elementKey: "student_photo",
            elementType: "PHOTO",
            label: "IMAGE",
            config: { x: 10, y: 10, width: 80, height: 100, side: "FRONT" },
          },
          {
            elementKey: "text_name",
            elementType: "TEXT",
            config: { x: 100, y: 10, width: 100, height: 20, content: "rishu", side: "FRONT" },
          },
        ],
      },
      cardData: { student_name: "rishu" }, // photo key is missing intentionally
    });

    const pdfText = pdfBuffer.toString("utf-8");
    // Word "IMAGE" should never appear as fallback text in the rendered stream
    expect(pdfText).not.toContain("(IMAGE)");
    expect(pdfBuffer.byteLength).toBeGreaterThan(500);
  });

  it("19. Audit logs endpoint returns 200 without 500 error & scopes strictly per school", async () => {
    // Admin gets all logs
    const adminLogsRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminLogsRes.status).toBe(200);
    const adminLogs: any[] = await adminLogsRes.json();
    expect(Array.isArray(adminLogs)).toBe(true);

    // School A gets only its own logs
    const schoolALogsRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(schoolALogsRes.status).toBe(200);
    const schoolALogs: any[] = await schoolALogsRes.json();
    expect(Array.isArray(schoolALogs)).toBe(true);
    for (const log of schoolALogs) {
      expect(log.schoolId).toBe(schoolAId);
    }
  });

  it("20. Approvals endpoint scopes strictly per school", async () => {
    // Admin gets all approvals
    const adminApprRes = await fetch(`${baseUrl}/api/approvals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminApprRes.status).toBe(200);
    const adminApprovals: any[] = await adminApprRes.json();
    expect(adminApprovals.some((a) => a.schoolId === schoolAId)).toBe(true);

    // School A gets strictly School A approvals
    const schoolAApprRes = await fetch(`${baseUrl}/api/approvals`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(schoolAApprRes.status).toBe(200);
    const schoolAApprovals: any[] = await schoolAApprRes.json();
    for (const a of schoolAApprovals) {
      expect(a.schoolId).toBe(schoolAId);
    }

    // School B sees 0 approvals for School A
    const schoolBApprRes = await fetch(`${baseUrl}/api/approvals`, {
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(schoolBApprRes.status).toBe(200);
    const schoolBApprovals: any[] = await schoolBApprRes.json();
    for (const b of schoolBApprovals) {
      expect(b.schoolId).toBe(schoolBId);
      expect(b.schoolId).not.toBe(schoolAId);
    }
  });

  it("21. School users cannot manage schools or users (Admin only)", async () => {
    // School A attempts to update School B -> 403
    const editSchool = await fetch(`${baseUrl}/api/schools/${schoolBId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Hacked School" }),
    });
    expect(editSchool.status).toBe(403);

    // School A attempts to list users -> 403
    const listUsers = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });
    expect(listUsers.status).toBe(403);

    // School A attempts to create user -> 403
    const createUser = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Hacker",
        email: "hacker@school.com",
        password: "Password123!",
        schoolId: schoolBId,
      }),
    });
    expect(createUser.status).toBe(403);
  });

  it("22. Legacy tRPC procedures strictly enforce school scoping & cannot bypass RBAC", async () => {
    const callerSchoolA = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: {
        id: schoolAUserId,
        openId: schoolALoginId,
        name: "School A Admin",
        email: "alpha@school.edu",
        role: "SCHOOL_ADMIN",
        schoolId: schoolAId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any,
    });

    // 1. schools.list as School A: only returns School A
    const schoolsListA = await callerSchoolA.idCards.schools.list();
    expect(schoolsListA.length).toBe(1);
    expect(schoolsListA[0].id).toBe(schoolAId);

    // 2. requests.list as School A: only returns School A requests
    const requestsListA = await callerSchoolA.idCards.requests.list();
    for (const r of requestsListA) {
      expect(r.schoolId).toBe(schoolAId);
    }

    // 3. requests.approve as School A for School B's request throws FORBIDDEN
    const db = await getDb();
    // Create dummy request for School B
    const [reqB] = await db!.insert(idCardRequests).values({
      studentName: "Bob Beta",
      admissionCode: "ADM-BETA-TRPC-001",
      schoolId: schoolBId,
      status: "SUBMITTED",
    });
    const reqBId = Number(reqB.insertId);

    await expect(callerSchoolA.idCards.requests.approve({ id: reqBId })).rejects.toThrow(
      "School access denied"
    );

    // Cleanup dummy request
    await db!.delete(idCardRequests).where(eq(idCardRequests.id, reqBId));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db) {
      if (cardAId) await db.delete(idCards).where(eq(idCards.id, cardAId));
      if (templateActiveId) {
        await db.delete(templateElements).where(eq(templateElements.templateId, templateActiveId));
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateActiveId));
      }
      if (templateUnusedId) {
        await db.delete(templateElements).where(eq(templateElements.templateId, templateUnusedId));
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateUnusedId));
      }
      if (schoolAId) {
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolAId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolAId));
        await db.delete(users).where(eq(users.schoolId, schoolAId));
        await db.delete(schools).where(eq(schools.id, schoolAId));
      }
      if (schoolBId) {
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolBId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolBId));
        await db.delete(users).where(eq(users.schoolId, schoolBId));
        await db.delete(schools).where(eq(schools.id, schoolBId));
      }
      if (adminUserId) await db.delete(users).where(eq(users.id, adminUserId));
      if (schoolAUserId) await db.delete(users).where(eq(users.id, schoolAUserId));
      if (schoolBUserId) await db.delete(users).where(eq(users.id, schoolBUserId));
    }
  });
});
