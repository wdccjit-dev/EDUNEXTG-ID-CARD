import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { schools, users, idCardTemplates, idCards, templateElements, schoolTemplates, idCardRequests } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Role-Based Permissions & ID Card Workflow Verification", () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let testAdminUserId: number;
  let testSchoolBUserId: number;
  let schoolBToken: string;
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;

  let createdSchoolId: number;
  let createdSchoolCode: string;
  let schoolLoginId: string;
  let schoolPassword: string;
  let schoolToken: string;

  let templateId: number;
  let cardId: number;
  let secondCardId: number;

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
    const testAdminEmail = `admin_rbac_${ts}@test.local`;
    const testSchoolBEmail = `school_b_rbac_${ts}@test.local`;
    const pwdHash = await hashPassword("TestPass123!");

    const [adminUserRes] = await db.insert(users).values({
      openId: `admin_rbac_${ts}`,
      email: testAdminEmail,
      name: "RBAC Test Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    testAdminUserId = Number(adminUserRes.insertId);

    const [schoolBUserRes] = await db.insert(users).values({
      openId: `school_b_rbac_${ts}`,
      email: testSchoolBEmail,
      name: "RBAC School B Admin",
      role: "SCHOOL_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    testSchoolBUserId = Number(schoolBUserRes.insertId);

    // Login as Super Admin
    const adminLogin = await loginUser(testAdminEmail, "TestPass123!");
    if (!adminLogin) throw new Error("Could not log in as super admin");
    adminToken = adminLogin.token;

    const schoolBLogin = await loginUser(testSchoolBEmail, "TestPass123!");
    if (!schoolBLogin) throw new Error("Could not log in as School B");
    schoolBToken = schoolBLogin.token;

    // Create a template for testing
    const [tmplRes] = await db.insert(idCardTemplates).values({
      name: `RBAC Test Template ${Date.now()}`,
      orientation: "landscape",
      cardWidth: 324,
      cardHeight: 204,
      status: "ACTIVE",
    });
    templateId = Number(tmplRes.insertId);

    // Insert student_name and photo elements into template
    await db.insert(templateElements).values([
      {
        templateId,
        elementKey: "field_name",
        elementType: "DYNAMIC_FIELD",
        label: "Student Name",
        config: { dynamicField: "student_name", x: 20, y: 30, width: 150, height: 20, side: "FRONT" },
        sortOrder: 0,
      },
      {
        templateId,
        elementKey: "photo_1",
        elementType: "PHOTO",
        label: "Student Photo",
        config: { x: 20, y: 60, width: 80, height: 100, side: "FRONT" },
        sortOrder: 1,
      },
    ]);
  });

  // ─── 1. SCHOOL CREATION & CREDENTIAL GENERATION ────────────────────────────
  it("Admin creates new school -> auto-generates unique Login ID and ID Pass", async () => {
    const uniqueCode = `RB${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `RBAC Academy ${uniqueCode}`,
        shortCode: uniqueCode,
        email: `contact@${uniqueCode.toLowerCase()}.test`,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.shortCode).toBe(uniqueCode);
    expect(body.credentials).toBeDefined();
    expect(body.credentials.loginId).toMatch(new RegExp(`^SCH_${uniqueCode}`));
    expect(body.credentials.password).toBeDefined();
    expect(body.credentials.password.length).toBeGreaterThanOrEqual(12);

    createdSchoolId = body.id;
    createdSchoolCode = uniqueCode;
    schoolLoginId = body.credentials.loginId;
    schoolPassword = body.credentials.password;
  });

  it("Admin can view and regenerate school credentials via credentials endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${createdSchoolId}/credentials`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.credentials.loginId).toMatch(new RegExp(`^SCH_${createdSchoolCode}`));
    expect(body.credentials.password).toBeDefined();

    // Update password to the freshly generated one
    schoolPassword = body.credentials.password;
  });

  it("School admin can log in using the auto-generated School Login ID and password", async () => {
    const loginResult = await loginUser(schoolLoginId, schoolPassword);
    expect(loginResult).not.toBeNull();
    expect(loginResult?.user.role).toBe("SCHOOL_ADMIN");
    expect(loginResult?.user.schoolId).toBe(createdSchoolId);
    expect(loginResult?.token).toBeDefined();

    schoolToken = loginResult!.token;
  });

  // ─── 2. TEMPLATE SELECTION WORKFLOW ───────────────────────────────────────
  it("Admin sees school template selection status initially as 'Not Selected'", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${createdSchoolId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const school = await res.json();
    expect(school.templateSelectionStatus).toBe("Not Selected");
    expect(school.selectedTemplateId).toBeNull();
  });

  it("School views templates and selects preferred template as final template", async () => {
    // School views templates
    const listRes = await fetch(`${baseUrl}/api/templates`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(listRes.status).toBe(200);

    // School selects template
    const selectRes = await fetch(`${baseUrl}/api/schools/${createdSchoolId}/templates/select`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId }),
    });

    expect(selectRes.status).toBe(200);
    const selectBody = await selectRes.json();
    expect(selectBody.success).toBe(true);
    expect(selectBody.selectedTemplateId).toBe(templateId);
  });

  it("Admin now sees school template status as 'Selected' with template name", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${createdSchoolId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const school = await res.json();
    expect(school.templateSelectionStatus).toBe("Selected");
    expect(school.selectedTemplateId).toBe(templateId);
    expect(school.selectedTemplateName).toBeDefined();
  });

  it("School CANNOT create or manage templates (restricted to Admin)", async () => {
    const res = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Unauthorized Template",
        status: "ACTIVE",
      }),
    });
    expect(res.status).toBe(403);
  });

  // ─── 3. ID CARD CREATION & PERMISSION MATRIX ──────────────────────────────
  it("Admin creates ID card for school -> succeeds with status DRAFT", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: createdSchoolId,
        templateId,
        data: {
          student_name: "Benjamin Harrison",
          photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      }),
    });

    expect(res.status).toBe(201);
    const card = await res.json();
    expect(card.id).toBeDefined();
    expect(card.status).toBe("DRAFT");
    expect(card.schoolId).toBe(createdSchoolId);

    cardId = card.id;
  });

  it("School CANNOT create ID cards -> rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: createdSchoolId,
        templateId,
        data: {
          student_name: "Unauthorized Student",
        },
      }),
    });

    expect(res.status).toBe(403);
  });

  it("Admin edits ID card details -> succeeds", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          student_name: "Benjamin Harrison Jr.",
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("School CANNOT edit ID cards -> rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          student_name: "Hacked Name",
        },
      }),
    });

    expect(res.status).toBe(403);
  });

  it("School CANNOT delete ID cards -> rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
      },
    });

    expect(res.status).toBe(403);
  });

  // ─── 4. SUBMISSION & APPROVAL WORKFLOW ─────────────────────────────────────
  it("Admin submits card for school approval -> status becomes SUBMITTED", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studentName: "Benjamin Harrison Jr." }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("SUBMITTED");

    // School verifies card is in SUBMITTED status
    const cardRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    const card = await cardRes.json();
    expect(card.status).toBe("SUBMITTED");
  });

  it("School CANNOT print card in SUBMITTED status -> rejected with 403", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("School approves submitted ID card -> status transitions to APPROVED", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
  });

  it("School CANNOT print card even when APPROVED -> rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("School CANNOT download card PDF -> rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/pdf`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("Admin CAN print approved card and download PDF", async () => {
    // Admin prints card
    const printRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(printRes.status).toBe(200);
    const printBody = await printRes.json();
    expect(printBody.status).toBe("PRINTED");

    // Admin downloads PDF
    const pdfRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toContain("application/pdf");
  });

  // ─── 5. REJECTION WORKFLOW & CROSS-SCHOOL ISOLATION ────────────────────────
  it("Rejection flow: Admin creates and submits card -> School rejects with reason", async () => {
    // Admin creates second card
    const cRes = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: createdSchoolId,
        templateId,
        data: {
          student_name: "Clara Barton",
          photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      }),
    });
    const card = await cRes.json();
    secondCardId = card.id;

    // Admin submits card
    await fetch(`${baseUrl}/api/id-cards/${secondCardId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ studentName: "Clara Barton" }),
    });

    // Rejection without reason fails with 400
    const failRes = await fetch(`${baseUrl}/api/id-cards/${secondCardId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "" }),
    });
    expect(failRes.status).toBe(400);

    // Rejection with reason succeeds
    const rejectRes = await fetch(`${baseUrl}/api/id-cards/${secondCardId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "Student transferred to another branch" }),
    });
    expect(rejectRes.status).toBe(200);
    const rejectBody = await rejectRes.json();
    expect(rejectBody.status).toBe("REJECTED");
  });

  it("Cross-school isolation: Another school user CANNOT view or approve this card", async () => {
    // School B attempts to view School A's card
    const viewRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(viewRes.status).toBe(403);

    // School B attempts to approve School A's card
    const approveRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolBToken}` },
    });
    expect(approveRes.status).toBe(403);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (db) {
      if (cardId) await db.delete(idCards).where(eq(idCards.id, cardId));
      if (secondCardId) await db.delete(idCards).where(eq(idCards.id, secondCardId));
      if (createdSchoolId) {
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, createdSchoolId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, createdSchoolId));
        await db.delete(users).where(eq(users.schoolId, createdSchoolId));
        await db.delete(schools).where(eq(schools.id, createdSchoolId));
      }
      if (templateId) {
        await db.delete(templateElements).where(eq(templateElements.templateId, templateId));
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateId));
      }
      if (testAdminUserId) await db.delete(users).where(eq(users.id, testAdminUserId));
      if (testSchoolBUserId) await db.delete(users).where(eq(users.id, testSchoolBUserId));
    }
  });
});
