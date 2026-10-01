import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import AdmZip from "adm-zip";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import {
  idCards,
  idCardData,
  idCardFiles,
  idCardRequests,
  schools,
  users,
  idCardTemplates,
  schoolTemplates,
} from "../drizzle/schema";
import { eq, inArray, and } from "drizzle-orm";

describe("Bulk Photo Upload (Admission Number & Employee ID) Suite", () => {
  let server: http.Server;
  let baseUrl: string;

  let schoolAId: number;
  let schoolBId: number;
  let studentTemplateId: number;
  let staffTemplateId: number;

  let adminToken: string;
  let schoolAToken: string;
  let schoolBToken: string;

  let studentCardId: number;
  let staffCardId: number;

  // 1x1 transparent PNG sample base64
  const samplePhotoBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required for test");

    const app = express();
    app.use(express.json({ limit: "50mb" }));
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

    const uniqueSuffix = Date.now().toString().slice(-4);

    // 1. Create schools
    const [resA] = await db.insert(schools).values({
      name: `Photo School A ${uniqueSuffix}`,
      shortCode: `PA${uniqueSuffix}`,
      isActive: true,
    });
    schoolAId = Number(resA.insertId);

    const [resB] = await db.insert(schools).values({
      name: `Photo School B ${uniqueSuffix}`,
      shortCode: `PB${uniqueSuffix}`,
      isActive: true,
    });
    schoolBId = Number(resB.insertId);

    // 2. Create student & staff templates
    const [tStudent] = await db.insert(idCardTemplates).values({
      name: `Student Template ${uniqueSuffix}`,
      status: "ACTIVE",
      cardType: "student",
      accent: "teal",
      orientation: "portrait",
    });
    studentTemplateId = Number(tStudent.insertId);

    const [tStaff] = await db.insert(idCardTemplates).values({
      name: `Staff Template ${uniqueSuffix}`,
      status: "ACTIVE",
      cardType: "staff",
      accent: "indigo",
      orientation: "landscape",
    });
    staffTemplateId = Number(tStaff.insertId);

    // 3. Create users
    const pwdHash = await hashPassword("TestPass123!");
    const ts = Date.now();
    const adminEmail = `admin_photo_${ts}@test.local`;
    const schoolAEmail = `school_a_photo_${ts}@test.local`;
    const schoolBEmail = `school_b_photo_${ts}@test.local`;

    await db.insert(users).values([
      {
        openId: `admin_p_${ts}`,
        email: adminEmail,
        name: "Admin Photo",
        role: "SUPER_ADMIN",
        schoolId: null,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
      {
        openId: `school_a_p_${ts}`,
        email: schoolAEmail,
        name: "School A Photo Admin",
        role: "SCHOOL_ADMIN",
        schoolId: schoolAId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
      {
        openId: `school_b_p_${ts}`,
        email: schoolBEmail,
        name: "School B Photo Admin",
        role: "SCHOOL_ADMIN",
        schoolId: schoolBId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
    ]);

    const adminLogin = await loginUser(adminEmail, "TestPass123!");
    adminToken = adminLogin!.token;

    const schoolALogin = await loginUser(schoolAEmail, "TestPass123!");
    schoolAToken = schoolALogin!.token;

    const schoolBLogin = await loginUser(schoolBEmail, "TestPass123!");
    schoolBToken = schoolBLogin!.token;

    // 4. Create sample student card in School A (Admission No: ADM-101)
    const [cardStudentRes] = await db.insert(idCards).values({
      schoolId: schoolAId,
      templateId: studentTemplateId,
      cardNumber: "ADM-101",
      status: "DRAFT",
    });
    studentCardId = Number(cardStudentRes.insertId);

    await db.insert(idCardData).values([
      { idCardId: studentCardId, fieldKey: "student_name", fieldValue: "Rohan Sharma" },
      { idCardId: studentCardId, fieldKey: "admission_number", fieldValue: "ADM-101" },
      { idCardId: studentCardId, fieldKey: "class", fieldValue: "10" },
    ]);

    // 5. Create sample staff card in School A (Employee ID: EMP-202)
    const [cardStaffRes] = await db.insert(idCards).values({
      schoolId: schoolAId,
      templateId: staffTemplateId,
      cardNumber: "EMP-202",
      status: "DRAFT",
    });
    staffCardId = Number(cardStaffRes.insertId);

    await db.insert(idCardData).values([
      { idCardId: staffCardId, fieldKey: "staff_name", fieldValue: "Dr. Alok Verma" },
      { idCardId: staffCardId, fieldKey: "employee_id", fieldValue: "EMP-202" },
      { idCardId: staffCardId, fieldKey: "department", fieldValue: "Physics" },
    ]);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("Scenario 1: Dry-run scan matches student admission number and staff employee ID without database updates", async () => {
    const res = await fetch(`${baseUrl}/api/id-card-requests/bulk-upload-photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        images: [
          { filename: "adm-101.jpg", dataBase64: samplePhotoBase64 },
          { filename: "EMP-202.png", dataBase64: samplePhotoBase64 },
          { filename: "UNKNOWN-999.jpg", dataBase64: samplePhotoBase64 },
        ],
        dryRun: true,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.total).toBe(3);
    expect(data.matched).toBe(2);
    expect(data.unmatched).toBe(1);

    const studentMatch = data.results.find((r: any) => r.identifier === "adm-101");
    expect(studentMatch).toBeDefined();
    expect(studentMatch.matched).toBe(true);
    expect(studentMatch.cardId).toBe(studentCardId);
    expect(studentMatch.name).toBe("Rohan Sharma");
    expect(studentMatch.isStaff).toBe(false);

    const staffMatch = data.results.find((r: any) => r.identifier === "EMP-202");
    expect(staffMatch).toBeDefined();
    expect(staffMatch.matched).toBe(true);
    expect(staffMatch.cardId).toBe(staffCardId);
    expect(staffMatch.name).toBe("Dr. Alok Verma");
    expect(staffMatch.isStaff).toBe(true);

    const unknownMatch = data.results.find((r: any) => r.identifier === "UNKNOWN-999");
    expect(unknownMatch).toBeDefined();
    expect(unknownMatch.matched).toBe(false);

    // Verify DB was NOT modified in dry-run
    const db = await getDb();
    const photoFiles = await db!.select().from(idCardFiles).where(eq(idCardFiles.idCardId, studentCardId));
    expect(photoFiles.length).toBe(0);
  });

  it("Scenario 2: Bulk upload multi-image attaches photos to student and staff cards", async () => {
    const res = await fetch(`${baseUrl}/api/id-card-requests/bulk-upload-photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        images: [
          { filename: "ADM-101.png", dataBase64: samplePhotoBase64 },
          { filename: "emp-202.jpeg", dataBase64: samplePhotoBase64 },
        ],
        dryRun: false,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.matched).toBe(2);
    expect(data.unmatched).toBe(0);

    const db = await getDb();

    // Verify student card dynamic fields and files
    const studentData = await db!.select().from(idCardData).where(eq(idCardData.idCardId, studentCardId));
    const studentPhoto = studentData.find((d) => d.fieldKey === "photo");
    expect(studentPhoto).toBeDefined();
    expect(studentPhoto?.fieldValue).toContain("data:image/jpeg;base64");

    const studentFile = (await db!.select().from(idCardFiles).where(eq(idCardFiles.idCardId, studentCardId)))[0];
    expect(studentFile).toBeDefined();
    expect(studentFile.fileType).toBe("PHOTO");
    expect(studentFile.fileName).toBe("ADM-101.jpg");

    // Verify staff card dynamic fields and files
    const staffData = await db!.select().from(idCardData).where(eq(idCardData.idCardId, staffCardId));
    const staffPhoto = staffData.find((d) => d.fieldKey === "photo");
    const staffSpecificPhoto = staffData.find((d) => d.fieldKey === "staff_photo");
    expect(staffPhoto).toBeDefined();
    expect(staffSpecificPhoto).toBeDefined();
    expect(staffPhoto?.fieldValue).toContain("data:image/jpeg;base64");

    const staffFile = (await db!.select().from(idCardFiles).where(eq(idCardFiles.idCardId, staffCardId)))[0];
    expect(staffFile).toBeDefined();
    expect(staffFile.fileType).toBe("PHOTO");
    expect(staffFile.fileName).toBe("emp-202.jpg");
  });

  it("Scenario 3: Bulk upload via ZIP archive extracts, compresses and attaches photos", async () => {
    // Create an in-memory ZIP file using AdmZip
    const zip = new AdmZip();
    const sampleBuffer = Buffer.from(samplePhotoBase64, "base64");
    zip.addFile("photos/ADM-101.jpg", sampleBuffer);
    zip.addFile("photos/EMP-202.png", sampleBuffer);
    const zipBuffer = zip.toBuffer();
    const zipBase64 = zipBuffer.toString("base64");

    const res = await fetch(`${baseUrl}/api/id-card-requests/bulk-upload-photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zipBase64,
        dryRun: false,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.total).toBe(2);
    expect(data.matched).toBe(2);
    expect(data.unmatched).toBe(0);
  });

  it("Scenario 4: Multi-tenant security prevents School B from modifying School A cards", async () => {
    // School B attempts to upload a photo with schoolId = schoolAId
    const res = await fetch(`${baseUrl}/api/id-card-requests/bulk-upload-photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schoolBToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        images: [{ filename: "ADM-101.jpg", dataBase64: samplePhotoBase64 }],
      }),
    });

    expect(res.status).toBe(403);
    const err = await res.json();
    expect(err.error).toMatch(/Forbidden|cannot upload photos for another school/i);
  });

  it("Scenario 5: Super Admin can specify schoolId and bulk upload photos", async () => {
    const res = await fetch(`${baseUrl}/api/id-card-requests/bulk-upload-photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId: schoolAId,
        images: [{ filename: "adm_101.jpg", dataBase64: samplePhotoBase64 }],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.matched).toBe(1);
  });
});
