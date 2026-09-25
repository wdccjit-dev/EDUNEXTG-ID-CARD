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
import { eq } from "drizzle-orm";

describe("Complete 16-Step End-to-End Real Workflow QA", () => {
  let server: http.Server;
  let baseUrl: string;

  // Track created entities through the 16 steps
  let adminToken: string;
  let masterAdminEmail: string;
  let schoolId: number;
  let schoolUserEmail: string;
  const schoolUserPassword = "SchoolPass123!";
  let schoolToken: string;
  let templateId: number;
  let cardId: number;
  let cardNumber: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required");

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

    // Seed master admin for login
    const ts = Date.now();
    masterAdminEmail = `admin_e2e_${ts}@test.local`;
    const pwdHash = await hashPassword("MasterAdmin123!");

    await db.insert(users).values({
      openId: `admin_openid_${ts}`,
      email: masterAdminEmail,
      name: "Master Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });

    // Step 1 helper: credentials for test
    (globalThis as any).__E2E_ADMIN_EMAIL = masterAdminEmail;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db && schoolId) {
      await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolId));
      await db.delete(idCards).where(eq(idCards.schoolId, schoolId));
      await db.delete(notifications).where(eq(notifications.schoolId, schoolId));
      await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolId));
      await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolId));
      await db.delete(users).where(eq(users.schoolId, schoolId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
    if (db && templateId) {
      await db.delete(templateElements).where(eq(templateElements.templateId, templateId));
      await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateId));
    }
    if (db && masterAdminEmail) {
      await db.delete(users).where(eq(users.email, masterAdminEmail));
    }
  });

  // 1. Admin login
  it("Step 1: Admin login authenticates and returns valid JWT token", async () => {
    const adminEmail = (globalThis as any).__E2E_ADMIN_EMAIL;
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: "MasterAdmin123!",
      }),
    });

    expect(loginRes.status).toBe(200);
    const data = await loginRes.json();
    expect(data.user.role).toBe("SUPER_ADMIN");
    expect(data.token).toBeDefined();
    adminToken = data.token;
  });

  // 2. Create school
  it("Step 2: Admin creates school via POST /api/schools", async () => {
    const suffix = Date.now().toString().slice(-4);
    const res = await fetch(`${baseUrl}/api/schools`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Oakridge Academy ${suffix}`,
        shortCode: `OA${suffix}`,
        phone: "9876543210",
        email: `info@oakridge${suffix}.edu`,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.isActive).toBe(true);
    schoolId = body.id;
  });

  // 3. Create school user
  it("Step 3: Admin creates school user assigned to the new school", async () => {
    const suffix = Date.now().toString().slice(-4);
    schoolUserEmail = `operator_${suffix}@oakridge.edu`;

    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Arthur Pendelton",
        email: schoolUserEmail,
        password: schoolUserPassword,
        role: "SCHOOL_ADMIN",
        schoolId,
      }),
    });

    expect(res.status).toBe(201);
    const user = await res.json();
    expect(user.email).toBe(schoolUserEmail);
    expect(user.role).toBe("SCHOOL_ADMIN");
    expect(user.schoolId).toBe(schoolId);
  });

  // 4. Create and activate template
  it("Step 4: Admin creates template, sets elements, and activates it", async () => {
    // Create draft template
    const createRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Oakridge Standard 2026",
        description: "Official student identification card",
        orientation: "landscape",
        cardWidth: 324,
        cardHeight: 204,
        status: "DRAFT",
        accent: "teal",
      }),
    });

    expect(createRes.status).toBe(201);
    const tmpl = await createRes.json();
    templateId = tmpl.id;

    // Design template elements (Title, Student Name, Admission No, Photo, QR Code)
    const elementsRes = await fetch(`${baseUrl}/api/templates/${templateId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        elements: [
          {
            elementKey: "school_header",
            elementType: "TEXT",
            label: "School Header",
            config: {
              x: 15,
              y: 15,
              width: 200,
              height: 25,
              content: "OAKRIDGE ACADEMY",
              fontSize: 14,
              fontWeight: "bold",
              textColor: "#0f7f79",
              side: "FRONT",
            },
            sortOrder: 0,
          },
          {
            elementKey: "student_name_field",
            elementType: "DYNAMIC_FIELD",
            label: "Student Name",
            config: {
              x: 15,
              y: 45,
              width: 180,
              height: 22,
              dynamicField: "student_name",
              fontSize: 12,
              fontWeight: "bold",
              side: "FRONT",
            },
            sortOrder: 1,
          },
          {
            elementKey: "admission_field",
            elementType: "DYNAMIC_FIELD",
            label: "Admission No",
            config: {
              x: 15,
              y: 72,
              width: 140,
              height: 18,
              dynamicField: "admission_number",
              fontSize: 10,
              side: "FRONT",
            },
            sortOrder: 2,
          },
          {
            elementKey: "student_photo_el",
            elementType: "PHOTO",
            label: "Student Photo",
            config: {
              x: 215,
              y: 15,
              width: 90,
              height: 110,
              borderRadius: 6,
              side: "FRONT",
            },
            sortOrder: 3,
          },
          {
            elementKey: "qr_code_el",
            elementType: "QR_CODE",
            label: "Verification QR",
            config: {
              x: 15,
              y: 115,
              width: 60,
              height: 60,
              qrField: "admission_number",
              side: "FRONT",
            },
            sortOrder: 4,
          },
        ],
      }),
    });
    expect(elementsRes.status).toBe(200);

    // Activate template
    const activateRes = await fetch(`${baseUrl}/api/templates/${templateId}/status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    expect(activateRes.status).toBe(200);
  });

  // 5. School login
  it("Step 5: School user logs in successfully with new credentials", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: schoolUserEmail,
        password: schoolUserPassword,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(schoolUserEmail);
    expect(data.user.role).toBe("SCHOOL_ADMIN");
    expect(data.user.schoolId).toBe(schoolId);
    expect(data.token).toBeDefined();
    schoolToken = data.token;
  });

  // 6. Select and lock template
  it("Step 6: School selects and locks the active template for their school", async () => {
    // Select
    const selectRes = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/select`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId }),
    });
    expect(selectRes.status).toBe(200);

    // Lock
    const lockRes = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/lock`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ templateId }),
    });
    expect(lockRes.status).toBe(200);
  });

  // 7. Create ID card
  it("Step 7: Admin creates ID card draft for school with auto-generated card number", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        templateId,
        data: {
          student_name: "Benjamin Vance",
          admission_number: "ADM-OAK-042",
          grade: "11-B",
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe("DRAFT");
    expect(body.cardNumber).toMatch(/^IDC-\d{4}-\d{6}$/);
    cardId = body.id;
    cardNumber = body.cardNumber;
  });

  // 8. Upload photo/signature
  it("Step 8: Admin uploads photo via /api/upload and attaches to ID card files", async () => {
    // 1x1 transparent PNG sample base64
    const samplePhotoBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: "benjamin_vance.png",
        contentType: "image/png",
        dataBase64: samplePhotoBase64,
      }),
    });

    expect(uploadRes.status).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.url).toBeDefined();

    // Attach file record to card
    const fileRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileType: "PHOTO",
        fileName: "benjamin_vance.png",
        fileUrl: uploadData.url,
      }),
    });

    expect(fileRes.status).toBe(201);
    const file = await fileRes.json();
    expect(file.fileType).toBe("PHOTO");
  });

  // 9. Save draft
  it("Step 9: Admin saves draft, updates fields, and School can view card details", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          emergency_phone: "+1-555-9090",
          blood_group: "O+",
        },
      }),
    });

    expect(res.status).toBe(200);

    // Verify persistence after simulated refresh by school
    const getRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(getRes.status).toBe(200);
    const detail = await getRes.json();
    expect(detail.dataMap.student_name).toBe("Benjamin Vance");
    expect(detail.dataMap.admission_number).toBe("ADM-OAK-042");
    expect(detail.dataMap.emergency_phone).toBe("+1-555-9090");
    expect(detail.dataMap.blood_group).toBe("O+");
    expect(detail.files.length).toBeGreaterThanOrEqual(1);
  });

  // 10. Submit for approval
  it("Step 10: Admin submits card for school approval, status transitions to SUBMITTED", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentName: "Benjamin Vance",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("SUBMITTED");

    // Verify card status in DB via school view
    const cardRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    const card = await cardRes.json();
    expect(card.status).toBe("SUBMITTED");
  });

  // 11. School inspects card
  it("Step 11: School inspects submitted card in their queue", async () => {
    // School reads card details
    const getRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(getRes.status).toBe(200);
    const card = await getRes.json();
    expect(card.status).toBe("SUBMITTED");
    expect(card.schoolId).toBe(schoolId);
  });

  // 12. Request changes
  it("Step 12: School requests changes with mandatory comment, status becomes CHANGES_REQUIRED", async () => {
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/request-changes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Please specify middle initial in student full name.",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CHANGES_REQUIRED");
  });

  // 13. Admin edit and resubmit
  it("Step 13: Admin updates corrected student name and resubmits (RESUBMITTED)", async () => {
    // Verify admin sees the change request comment
    const getRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const detail = await getRes.json();
    expect(detail.status).toBe("CHANGES_REQUIRED");
    const lastHistory = detail.approvalHistory[detail.approvalHistory.length - 1];
    expect(lastHistory.comments).toContain("middle initial");

    // Admin edits card
    const editRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          student_name: "Benjamin R. Vance",
        },
      }),
    });
    expect(editRes.status).toBe(200);

    // Admin resubmits
    const submitRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();
    expect(submitBody.status).toBe("RESUBMITTED");
  });

  // 14. School approve
  it("Step 14: School approves the card (APPROVED); School attempts to edit or delete return 403 Forbidden", async () => {
    const approveRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(approveRes.status).toBe(200);
    const body = await approveRes.json();
    expect(body.status).toBe("APPROVED");

    // Verify card cannot be edited by School
    const editRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { student_name: "Sneaky Update" } }),
    });
    expect(editRes.status).toBe(403);

    // Verify card cannot be deleted by School
    const delRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(delRes.status).toBe(403);
  });

  // 15. Generate PDF
  it("Step 15: Admin generates PDF endpoint matching card; School download attempt returns 403", async () => {
    // School attempt returns 403
    const schoolPdfRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/pdf`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(schoolPdfRes.status).toBe(403);

    // Admin attempt returns 200
    const res = await fetch(`${baseUrl}/api/id-cards/${cardId}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(500);

    // Check PDF magic header %PDF-
    const headerBytes = new Uint8Array(buffer.slice(0, 5));
    const headerStr = String.fromCharCode(...headerBytes);
    expect(headerStr).toBe("%PDF-");
  });

  // 16. Print card
  it("Step 16: Admin prints card (transitions to PRINTED); School print attempt returns 403", async () => {
    // School print returns 403
    const schoolPrintRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(schoolPrintRes.status).toBe(403);

    // Admin print succeeds
    const printRes = await fetch(`${baseUrl}/api/id-cards/${cardId}/print`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(printRes.status).toBe(200);
    const body = await printRes.json();
    expect(body.status).toBe("PRINTED");

    // Verify status in DB persists
    const cardRes = await fetch(`${baseUrl}/api/id-cards/${cardId}`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    const finalCard = await cardRes.json();
    expect(finalCard.status).toBe("PRINTED");
    expect(finalCard.printedAt).toBeDefined();

    // Verify audit logs and notifications were created
    const db = await getDb();
    if (!db) throw new Error("DB missing");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.schoolId, schoolId));
    expect(logs.length).toBeGreaterThanOrEqual(5);

    const notifs = await db.select().from(notifications).where(eq(notifications.schoolId, schoolId));
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });
});
