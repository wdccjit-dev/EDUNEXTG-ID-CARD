import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import * as xlsx from "xlsx";
import { apiRouter } from "./api";

function getPdfPageCount(buffer: Buffer): number {
  return (buffer.toString("binary").match(/\/Type\s*\/Page\b/g) || []).length;
}
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import {
  idCards,
  idCardData,
  idCardRequests,
  schools,
  users,
  idCardTemplates,
  templateElements,
  schoolTemplates,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generateExampleExcelBuffer,
  parseExcelBuffer,
} from "./excel";
import {
  getAvailableDynamicFields,
  cleanExcelCellValue,
} from "../shared/templateDesigner";

describe("EDUNEXTG ID Card Updates End-to-End Suite", () => {
  let server: http.Server;
  let baseUrl: string;

  let schoolAId: number;
  let schoolBId: number;
  let templateId: number;

  let adminToken: string;
  let schoolAToken: string;
  let schoolBToken: string;

  let approvedCardId: number;
  let approvedCardDbId: number;
  let submittedCardId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required for test");

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

    const uniqueSuffix = Date.now().toString().slice(-4);
    const [resA] = await db.insert(schools).values({
      name: `Update Test School A ${uniqueSuffix}`,
      shortCode: `UA${uniqueSuffix}`,
      isActive: true,
    });
    schoolAId = Number(resA.insertId);

    const [resB] = await db.insert(schools).values({
      name: `Update Test School B ${uniqueSuffix}`,
      shortCode: `UB${uniqueSuffix}`,
      isActive: true,
    });
    schoolBId = Number(resB.insertId);

    // Create a template with custom dynamic fields
    const [tmplRes] = await db.insert(idCardTemplates).values({
      name: `Update Test Template ${uniqueSuffix}`,
      status: "ACTIVE",
      accent: "teal",
      cardWidth: 324,
      cardHeight: 204,
      orientation: "landscape",
    });
    templateId = Number(tmplRes.insertId);

    await db.insert(templateElements).values([
      {
        templateId,
        elementKey: "el_student_name",
        elementType: "DYNAMIC_FIELD",
        label: "Student Name",
        config: { x: 20, y: 30, width: 150, height: 25, dynamicField: "student_name", side: "front" },
        sortOrder: 0,
      },
      {
        templateId,
        elementKey: "el_father_name",
        elementType: "DYNAMIC_FIELD",
        label: "Father Name",
        config: { x: 20, y: 60, width: 150, height: 25, dynamicField: "father_name", side: "front" },
        sortOrder: 1,
      },
      {
        templateId,
        elementKey: "el_phone",
        elementType: "DYNAMIC_FIELD",
        label: "Phone",
        config: { x: 20, y: 90, width: 150, height: 25, dynamicField: "phone", side: "front" },
        sortOrder: 2,
      },
      {
        templateId,
        elementKey: "el_roll_no",
        elementType: "DYNAMIC_FIELD",
        label: "Roll No",
        config: { x: 20, y: 120, width: 100, height: 25, dynamicField: "roll_no", side: "front" },
        sortOrder: 3,
      },
      {
        templateId,
        elementKey: "el_address",
        elementType: "DYNAMIC_FIELD",
        label: "Address",
        config: { x: 20, y: 30, width: 250, height: 40, dynamicField: "address", side: "back" },
        sortOrder: 4,
      },
    ]);

    // Bind template to School A
    await db.insert(schoolTemplates).values({
      schoolId: schoolAId,
      templateId,
      isDefault: true,
      isLocked: true,
      lockedAt: new Date(),
    });

    // Create users
    const pwdHash = await hashPassword("TestPass123!");
    const ts = Date.now();
    const adminEmail = `admin_upd_${ts}@test.local`;
    const schoolAEmail = `school_a_upd_${ts}@test.local`;
    const schoolBEmail = `school_b_upd_${ts}@test.local`;

    await db.insert(users).values([
      {
        openId: `admin_upd_${ts}`,
        email: adminEmail,
        name: "Super Admin",
        role: "SUPER_ADMIN",
        schoolId: null,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
      {
        openId: `school_a_upd_${ts}`,
        email: schoolAEmail,
        name: "School A Operator",
        role: "SCHOOL_OPERATOR",
        schoolId: schoolAId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
      {
        openId: `school_b_upd_${ts}`,
        email: schoolBEmail,
        name: "School B Operator",
        role: "SCHOOL_OPERATOR",
        schoolId: schoolBId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      },
    ]);

    const adminAuth = await loginUser(adminEmail, "TestPass123!");
    if (!adminAuth) throw new Error("Admin login failed");
    adminToken = adminAuth.token;

    const schoolAAuth = await loginUser(schoolAEmail, "TestPass123!");
    if (!schoolAAuth) throw new Error("School A login failed");
    schoolAToken = schoolAAuth.token;

    const schoolBAuth = await loginUser(schoolBEmail, "TestPass123!");
    if (!schoolBAuth) throw new Error("School B login failed");
    schoolBToken = schoolBAuth.token;

    // Create requests & cards for status testing
    const [req1Res] = await db.insert(idCardRequests).values({
      schoolId: schoolAId,
      studentName: "Submitted Student",
      admissionCode: `ADM-SUB-${ts}`,
      status: "SUBMITTED",
      submittedAt: new Date(),
    });
    submittedCardId = Number(req1Res.insertId);

    const [card1Res] = await db.insert(idCards).values({
      schoolId: schoolAId,
      templateId,
      requestId: submittedCardId,
      cardNumber: `TEST-SUBMITTED-${ts}`,
      status: "SUBMITTED",
    });

    const [req2Res] = await db.insert(idCardRequests).values({
      schoolId: schoolAId,
      studentName: "Approved Student",
      admissionCode: `ADM-APP-${ts}`,
      status: "APPROVED",
      submittedAt: new Date(),
    });
    approvedCardId = Number(req2Res.insertId);

    const [card2Res] = await db.insert(idCards).values({
      schoolId: schoolAId,
      templateId,
      requestId: approvedCardId,
      cardNumber: `TEST-APPROVED-${ts}`,
      status: "APPROVED",
    });
    approvedCardDbId = Number(card2Res.insertId);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db) {
      if (schoolAId) {
        await db.delete(idCardData).where(eq(idCardData.idCardId, submittedCardId)).catch(() => {});
        await db.delete(idCardData).where(eq(idCardData.idCardId, approvedCardId)).catch(() => {});
        await db.delete(idCards).where(eq(idCards.schoolId, schoolAId)).catch(() => {});
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolAId)).catch(() => {});
        await db.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolAId)).catch(() => {});
        await db.delete(users).where(eq(users.schoolId, schoolAId)).catch(() => {});
        await db.delete(schools).where(eq(schools.id, schoolAId)).catch(() => {});
      }
      if (schoolBId) {
        await db.delete(idCards).where(eq(idCards.schoolId, schoolBId)).catch(() => {});
        await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, schoolBId)).catch(() => {});
        await db.delete(users).where(eq(users.schoolId, schoolBId)).catch(() => {});
        await db.delete(schools).where(eq(schools.id, schoolBId)).catch(() => {});
      }
      if (templateId) {
        await db.delete(templateElements).where(eq(templateElements.templateId, templateId)).catch(() => {});
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, templateId)).catch(() => {});
      }
    }
  });

  describe("1. ID Card Requests / Approvals Status Filtering", () => {
    it("should filter approvals list by status=SUBMITTED", async () => {
      const res = await fetch(`${baseUrl}/api/approvals?status=SUBMITTED`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      const ids = data.map((d: any) => d.id);
      expect(ids).toContain(submittedCardId);
      expect(ids).not.toContain(approvedCardId);
    });

    it("should filter approvals list by status=APPROVED", async () => {
      const res = await fetch(`${baseUrl}/api/approvals?status=APPROVED`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      const ids = data.map((d: any) => d.id);
      expect(ids).toContain(approvedCardId);
      expect(ids).not.toContain(submittedCardId);
    });

    it("should return all cards when status=All or omitted", async () => {
      const res = await fetch(`${baseUrl}/api/approvals?status=All`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const ids = data.map((d: any) => d.id);
      expect(ids).toContain(submittedCardId);
      expect(ids).toContain(approvedCardId);
    });
  });

  describe("2. Dynamic Fields & Example Excel Generation", () => {
    it("dynamically generates example Excel columns from template dynamic fields", async () => {
      const res = await fetch(`${baseUrl}/api/id-card-requests/example-excel?templateId=${templateId}`, {
        headers: { Authorization: `Bearer ${schoolAToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("spreadsheetml");

      const arrayBuffer = await res.arrayBuffer();
      const workbook = xlsx.read(Buffer.from(arrayBuffer), { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      const headerRow = rows[0];
      expect(headerRow).toBeDefined();
      // Should contain the template dynamic fields: Student Name, Father Name, Phone, Roll No, Address
      const normalizedHeaders = headerRow.map((h: string) => String(h).trim().toLowerCase());
      expect(normalizedHeaders).toContain("student name");
      expect(normalizedHeaders).toContain("father's name");
      expect(normalizedHeaders).toContain("phone");
      expect(normalizedHeaders).toContain("roll number");
      expect(normalizedHeaders).toContain("address");

      // Verify no fake student data row exists
      expect(rows.length).toBeLessThanOrEqual(2);
    });

    it("falls back to all available dynamic fields if no templateId is provided", async () => {
      const res = await fetch(`${baseUrl}/api/id-card-requests/example-excel`, {
        headers: { Authorization: `Bearer ${schoolAToken}` },
      });
      expect(res.status).toBe(200);
      const arrayBuffer = await res.arrayBuffer();
      const workbook = xlsx.read(Buffer.from(arrayBuffer), { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      const headerRow = rows[0];
      expect(headerRow.length).toBeGreaterThan(0);
    });
  });

  describe("3. Excel Upload & Critical Empty Value Pruning", () => {
    it("cleans cell values: trims whitespace, omits empty strings/nulls, preserves valid 0", () => {
      expect(cleanExcelCellValue("  Hello World  ")).toBe("Hello World");
      expect(cleanExcelCellValue("")).toBeUndefined();
      expect(cleanExcelCellValue("   ")).toBeUndefined();
      expect(cleanExcelCellValue(null)).toBeUndefined();
      expect(cleanExcelCellValue(undefined)).toBeUndefined();
      expect(cleanExcelCellValue(0)).toBe("0");
      expect(cleanExcelCellValue("0")).toBe("0");
      expect(cleanExcelCellValue("null")).toBeUndefined();
      expect(cleanExcelCellValue("NULL")).toBeUndefined();
      expect(cleanExcelCellValue("undefined")).toBeUndefined();
      expect(cleanExcelCellValue("N/A")).toBeUndefined();
    });

    it("strips malicious spreadsheet formula injection prefixes", () => {
      expect(cleanExcelCellValue("=SUM(1,2)")).toBe("SUM(1,2)");
      expect(cleanExcelCellValue("+CMD")).toBe("CMD");
      expect(cleanExcelCellValue("-10")).toBe("-10"); // valid negative number is preserved
      expect(cleanExcelCellValue("@calc")).toBe("calc");
    });

    it("safely uploads an Excel file and strictly omits empty dynamic-field values", async () => {
      // Create a test workbook matching the user prompt's exact example:
      // Student Name | Father Name | Address | Phone | Roll No
      // Rahul Kumar  | Raj Kumar   |         | 9876543210 | 0
      const testData = [
        ["Student Name", "Father Name", "Address", "Phone", "Roll No"],
        ["Rahul Kumar", "Raj Kumar", "   ", "9876543210", 0],
      ];
      const ws = xlsx.utils.aoa_to_sheet(testData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
      const fileBase64 = buffer.toString("base64");

      const res = await fetch(`${baseUrl}/api/id-card-requests/upload-excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${schoolAToken}`,
        },
        body: JSON.stringify({
          fileBase64,
          filename: "test_students.xlsx",
          templateId,
        }),
      });

      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);

      // Verify the database record created
      const db = await getDb();
      if (!db) throw new Error("No db");
      const [createdCard] = await db
        .select()
        .from(idCards)
        .where(eq(idCards.schoolId, schoolAId))
        .orderBy(desc(idCards.id))
        .limit(1);

      expect(createdCard).toBeDefined();

      const cardFields = await db
        .select()
        .from(idCardData)
        .where(eq(idCardData.idCardId, createdCard.id));

      const fieldMap = Object.fromEntries(cardFields.map((f) => [f.fieldKey, f.fieldValue]));

      // Populated fields
      expect(fieldMap["student_name"]).toBe("Rahul Kumar");
      expect(fieldMap["father_name"]).toBe("Raj Kumar");
      expect(fieldMap["phone"]).toBe("9876543210");
      expect(fieldMap["roll_number"]).toBe("0"); // valid 0 preserved!

      // CRITICAL: Address was empty/whitespace in Excel, so it MUST NOT be added/populated!
      expect(fieldMap["address"]).toBeUndefined();
      expect(fieldMap["address"]).not.toBe("null");
      expect(fieldMap["address"]).not.toBe("undefined");
      expect(fieldMap["address"]).not.toBe("");
    });

    it("enforces tenant isolation on Excel upload: School B cannot upload for School A", async () => {
      const testData = [
        ["Student Name", "Phone"],
        ["Sneha Patel", "9876543211"],
      ];
      const ws = xlsx.utils.aoa_to_sheet(testData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      const fileBase64 = xlsx.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");

      const res = await fetch(`${baseUrl}/api/id-card-requests/upload-excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${schoolBToken}`,
        },
        body: JSON.stringify({
          fileBase64,
          filename: "isolation_test.xlsx",
          schoolId: schoolAId, // Attempt to upload into School A!
          templateId,
        }),
      });

      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error).toContain("Forbidden");
    });
  });

  describe("4. Print PDF Generation (Front / Back / Both & 10-up layout)", () => {
    it("generates single card PDF with side=FRONT (1 page)", async () => {
      const res = await fetch(`${baseUrl}/api/id-cards/${approvedCardDbId}/pdf?side=FRONT`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");

      const pdfBytes = await res.arrayBuffer();
      expect(getPdfPageCount(Buffer.from(pdfBytes))).toBe(1);
    });

    it("generates single card PDF with side=BACK (1 page, horizontally mirrored layout)", async () => {
      const res = await fetch(`${baseUrl}/api/id-cards/${approvedCardDbId}/pdf?side=BACK`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");

      const pdfBytes = await res.arrayBuffer();
      expect(getPdfPageCount(Buffer.from(pdfBytes))).toBe(1);
    });

    it("generates single card PDF with side=BOTH (2 pages)", async () => {
      const res = await fetch(`${baseUrl}/api/id-cards/${approvedCardDbId}/pdf?side=BOTH`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);

      const pdfBytes = await res.arrayBuffer();
      expect(getPdfPageCount(Buffer.from(pdfBytes))).toBe(2);
    });

    it("generates 10-up sheets (e.g. 25 cards produces 3 pages per side and 6 duplex pages)", async () => {
      const db = await getDb();
      if (!db) throw new Error("No db");

      // Insert 24 additional cards so we have 25 total cards
      const newCardIds: number[] = [approvedCardDbId];
      const ts = Date.now();
      for (let i = 1; i <= 24; i++) {
        const [cRes] = await db.insert(idCards).values({
          schoolId: schoolAId,
          templateId,
          cardNumber: `TEST-BULK-${ts}-${i}`,
          status: "APPROVED",
        });
        newCardIds.push(Number(cRes.insertId));
      }

      expect(newCardIds.length).toBe(25);

      // Bulk PDF side=FRONT -> 25 cards / 10 per page = 3 pages
      const resFront = await fetch(`${baseUrl}/api/id-cards/bulk-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ cardIds: newCardIds, side: "FRONT" }),
      });
      expect(resFront.status).toBe(200);
      const pdfBytesFront = await resFront.arrayBuffer();
      expect(getPdfPageCount(Buffer.from(pdfBytesFront))).toBe(3);

      // Bulk PDF side=BACK -> 25 cards / 10 per page = 3 pages
      const resBack = await fetch(`${baseUrl}/api/id-cards/bulk-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ cardIds: newCardIds, side: "BACK" }),
      });
      expect(resBack.status).toBe(200);
      const pdfBytesBack = await resBack.arrayBuffer();
      expect(getPdfPageCount(Buffer.from(pdfBytesBack))).toBe(3);

      // Bulk PDF side=BOTH -> alternating front/back pages: 3 sheets per side = 6 pages
      const resBoth = await fetch(`${baseUrl}/api/id-cards/bulk-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ cardIds: newCardIds, side: "BOTH" }),
      });
      expect(resBoth.status).toBe(200);
      const pdfBytesBoth = await resBoth.arrayBuffer();
      expect(getPdfPageCount(Buffer.from(pdfBytesBoth))).toBe(6);
    });
  });

  describe("5. Approved vs Printed Status Distinction & Transition", () => {
    it("marks card as PRINTED and retains distinct status", async () => {
      const res = await fetch(`${baseUrl}/api/id-cards/${approvedCardDbId}/mark-printed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const db = await getDb();
      if (!db) throw new Error("No db");
      const [updatedCard] = await db.select().from(idCards).where(eq(idCards.id, approvedCardDbId));
      expect(updatedCard.status).toBe("PRINTED");
      expect(updatedCard.printedAt).toBeDefined();
    });
  });
});
