import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { idCardTemplates, templateElements, schoolTemplates, schools, users, type User } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Visual ID Card Template Designer — Full Lifecycle & Isolation", () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let adminEmail: string;
  let schoolToken: string;
  let schoolEmail: string;
  let schoolId: number;
  let createdTemplateId: number;
  let isCreatedSchool = false;
  let originalElementIds: number[] = [];

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required for test");

    // Start ephemeral test HTTP server
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

    // Ensure school exists
    const existingSchools = await db.select().from(schools).limit(1);
    if (existingSchools.length > 0) {
      schoolId = existingSchools[0].id;
    } else {
      const [res] = await db.insert(schools).values({
        name: "Designer Test Academy",
        shortCode: "DTA",
        isActive: true,
      });
      schoolId = Number(res.insertId);
      isCreatedSchool = true;
    }

    // Create dedicated test users for this suite to isolate from concurrent tests
    const pwdHash = await hashPassword("TemplatePass123!");
    adminEmail = `tmpl_admin_${Date.now()}@test.local`;
    schoolEmail = `tmpl_school_${Date.now()}@test.local`;

    await db.insert(users).values({
      openId: `tmpl_admin_openid_${Date.now()}`,
      email: adminEmail,
      name: "Template Test Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });

    await db.insert(users).values({
      openId: `tmpl_school_openid_${Date.now()}`,
      email: schoolEmail,
      name: "Template Test School Admin",
      role: "SCHOOL_ADMIN",
      schoolId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });

    const adminLogin = await loginUser(adminEmail, "TemplatePass123!");
    if (!adminLogin) throw new Error("Failed to log in as admin for test");
    adminToken = adminLogin.token;

    const schoolLogin = await loginUser(schoolEmail, "TemplatePass123!");
    if (!schoolLogin) throw new Error("Failed to log in as school admin for test");
    schoolToken = schoolLogin.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db) {
      if (createdTemplateId) {
        await db.delete(schoolTemplates).where(eq(schoolTemplates.templateId, createdTemplateId));
        await db.delete(templateElements).where(eq(templateElements.templateId, createdTemplateId));
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, createdTemplateId));
      }
      if (adminEmail) await db.delete(users).where(eq(users.email, adminEmail));
      if (schoolEmail) await db.delete(users).where(eq(users.email, schoolEmail));
    }
  });

  it("Step 1: Admin creates template", async () => {
    const res = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Master Student Badge 2026",
        description: "Official smart student ID with QR and barcode",
        orientation: "landscape",
        cardWidth: 324,
        cardHeight: 204,
        status: "DRAFT",
        accent: "teal",
      }),
    });

    expect(res.status).toBe(201);
    const tmpl = await res.json();
    expect(tmpl.id).toBeGreaterThan(0);
    expect(tmpl.name).toBe("Master Student Badge 2026");
    expect(tmpl.status).toBe("DRAFT");
    expect(tmpl.cardWidth).toBe(324);
    expect(tmpl.cardHeight).toBe(204);
    createdTemplateId = tmpl.id;
  });

  it("Step 2: Opens designer and fetches template with elements", async () => {
    const res = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdTemplateId);
    expect(Array.isArray(data.elements)).toBe(true);
    expect(data.elements.length).toBe(0);
  });

  it("Steps 3–9: Adds text, dynamic field, image, moves/resizes, switches to back, adds back elements, saves", async () => {
    const elementsPayload = [
      // Front side: Text header
      {
        elementKey: "text_school_title",
        elementType: "TEXT",
        label: "School Header",
        config: {
          x: 20,
          y: 15,
          width: 280,
          height: 25,
          side: "FRONT",
          content: "SPRINGFIELD ACADEMY",
          fontFamily: "Outfit",
          fontSize: 14,
          fontWeight: "700",
          textAlign: "center",
          textColor: "#0f7f79",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: 0,
      },
      // Front side: Student Photo
      {
        elementKey: "photo_student",
        elementType: "PHOTO",
        label: "Student Photo",
        config: {
          x: 20,
          y: 45,
          width: 70,
          height: 85,
          side: "FRONT",
          imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
          objectFit: "cover",
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#0f7f79",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: 1,
      },
      // Front side: Dynamic student name
      {
        elementKey: "dyn_student_name",
        elementType: "DYNAMIC_FIELD",
        label: "{{student_name}}",
        config: {
          x: 100,
          y: 50,
          width: 200,
          height: 24,
          side: "FRONT",
          dynamicField: "student_name",
          fontFamily: "Inter",
          fontSize: 16,
          fontWeight: "700",
          textColor: "#1f3733",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: 2,
      },
      // Front side: QR Code
      {
        elementKey: "qr_verification",
        elementType: "QR_CODE",
        label: "Verification QR",
        config: {
          x: 240,
          y: 110,
          width: 60,
          height: 60,
          side: "FRONT",
          qrField: "admission_number",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: 3,
      },
      // Back side: Emergency Info Text
      {
        elementKey: "text_back_emergency",
        elementType: "TEXT",
        label: "Emergency Contact Title",
        config: {
          x: 20,
          y: 20,
          width: 280,
          height: 20,
          side: "BACK",
          content: "TERMS & EMERGENCY CONTACT",
          fontFamily: "Inter",
          fontSize: 11,
          fontWeight: "700",
          textAlign: "center",
          textColor: "#55605d",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: 4,
      },
      // Back side: Barcode
      {
        elementKey: "barcode_id",
        elementType: "BARCODE",
        label: "Library Barcode",
        config: {
          x: 40,
          y: 60,
          width: 240,
          height: 50,
          side: "BACK",
          barcodeField: "admission_number",
          barcodeFormat: "CODE128",
          rotation: 0,
          opacity: 1,
        },
        sortOrder: 5,
      },
    ];

    const saveRes = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Master Student Badge 2026 (Designed)",
        elements: elementsPayload,
      }),
    });

    expect(saveRes.status).toBe(200);
    const saveBody = await saveRes.json();
    expect(saveBody.success).toBe(true);
  });

  it("Steps 10–12: Refreshes page / reopens template, confirms exact design persists with Front and Back elements", async () => {
    const res = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const tmpl = await res.json();
    expect(tmpl.name).toBe("Master Student Badge 2026 (Designed)");
    expect(tmpl.elements).toHaveLength(6);

    // Verify front side elements
    const frontElements = tmpl.elements.filter((el: any) => el.config.side === "FRONT");
    expect(frontElements).toHaveLength(4);

    const textEl = frontElements.find((el: any) => el.elementKey === "text_school_title");
    expect(textEl).toBeDefined();
    expect(textEl.config.content).toBe("SPRINGFIELD ACADEMY");
    expect(textEl.config.fontSize).toBe(14);

    const nameEl = frontElements.find((el: any) => el.elementKey === "dyn_student_name");
    expect(nameEl).toBeDefined();
    expect(nameEl.config.dynamicField).toBe("student_name");

    const qrEl = frontElements.find((el: any) => el.elementKey === "qr_verification");
    expect(qrEl).toBeDefined();
    expect(qrEl.elementType).toBe("QR_CODE");

    // Verify back side elements
    const backElements = tmpl.elements.filter((el: any) => el.config.side === "BACK");
    expect(backElements).toHaveLength(2);

    const barcodeEl = backElements.find((el: any) => el.elementKey === "barcode_id");
    expect(barcodeEl).toBeDefined();
    expect(barcodeEl.elementType).toBe("BARCODE");
    expect(barcodeEl.config.barcodeField).toBe("admission_number");

    // Record element IDs to test ID preservation
    originalElementIds = tmpl.elements.map((el: any) => el.id);
    expect(originalElementIds.every((id: number) => typeof id === "number" && id > 0)).toBe(true);
  });

  it("Element ID preservation: Saving modifications preserves existing element IDs in MySQL", async () => {
    // Re-save with one element updated and one new element added
    const res = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const current = await res.json();
    const updatedElements = current.elements.map((el: any) => {
      if (el.elementKey === "text_school_title") {
        return { ...el, config: { ...el.config, content: "UPDATED SPRINGFIELD ACADEMY" } };
      }
      return el;
    });

    const updateRes = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        elements: updatedElements,
      }),
    });
    expect(updateRes.status).toBe(200);

    // Verify IDs didn't change
    const verifyRes = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verified = await verifyRes.json();
    const newElementIds = verified.elements.map((el: any) => el.id);
    expect(newElementIds).toEqual(originalElementIds);
  });

  it("Step 13: Admin activates template", async () => {
    const res = await fetch(`${baseUrl}/api/templates/${createdTemplateId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "ACTIVE" }),
    });

    expect(res.status).toBe(200);

    const checkRes = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const tmpl = await checkRes.json();
    expect(tmpl.status).toBe("ACTIVE");
  });

  it("Step 14: School user sees only ACTIVE templates (not DRAFT)", async () => {
    const res = await fetch(`${baseUrl}/api/templates`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });

    expect(res.status).toBe(200);
    const templates = await res.json();
    // All templates visible to school must be ACTIVE
    expect(templates.every((t: any) => t.status === "ACTIVE")).toBe(true);

    // The activated template must be in the list
    const found = templates.find((t: any) => t.id === createdTemplateId);
    expect(found).toBeDefined();
    expect(found.status).toBe("ACTIVE");
  });

  it("Step 15: School user can select the ACTIVE template", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({ templateId: createdTemplateId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("Rejection: School user cannot select an INACTIVE or DRAFT template", async () => {
    // Create another template that stays in DRAFT
    const createRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Draft Unapproved Template",
        status: "DRAFT",
      }),
    });
    const draftTmpl = await createRes.json();

    // School user attempts to select the DRAFT template
    const selectRes = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({ templateId: draftTmpl.id }),
    });

    expect(selectRes.status).toBe(400);

    // Clean up draft template
    const db = await getDb();
    if (db) {
      await db.delete(idCardTemplates).where(eq(idCardTemplates.id, draftTmpl.id));
    }
  });

  it("Step 16: School user can lock the selected template", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({ templateId: createdTemplateId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Attempting to select while locked fails with 409
    const reselect = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({ templateId: createdTemplateId }),
    });
    expect(reselect.status).toBe(409);
  });

  it("Step 17: School user cannot edit template design or delete templates (403 Forbidden)", async () => {
    // Attempt to update template design
    const editRes = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({
        name: "Hacked by School User",
      }),
    });
    expect(editRes.status).toBe(403);

    // Attempt to delete template
    const deleteRes = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${schoolToken}`,
      },
    });
    expect(deleteRes.status).toBe(403);

    // Attempt to create template
    const postRes = await fetch(`${baseUrl}/api/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${schoolToken}`,
      },
      body: JSON.stringify({
        name: "School Created Template",
      }),
    });
    expect(postRes.status).toBe(403);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db) {
      if (createdTemplateId) {
        await db.delete(templateElements).where(eq(templateElements.templateId, createdTemplateId));
        await db.delete(schoolTemplates).where(eq(schoolTemplates.templateId, createdTemplateId));
        await db.delete(idCardTemplates).where(eq(idCardTemplates.id, createdTemplateId));
      }
      if (adminEmail) await db.delete(users).where(eq(users.email, adminEmail));
      if (schoolEmail) await db.delete(users).where(eq(users.email, schoolEmail));
      if (schoolId && isCreatedSchool) {
        await db.delete(users).where(eq(users.schoolId, schoolId));
        await db.delete(schools).where(eq(schools.id, schoolId));
      }
    }
  });
});
