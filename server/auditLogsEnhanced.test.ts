import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { apiRouter } from "./api";
import { loginUser, hashPassword } from "./appAuth";
import { getDb } from "./db";
import { auditLogs, idCardTemplates, schools, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Enhanced Audit Logs - Template Selection & Card Lifecycle Verification", () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let schoolToken: string;
  let schoolId: number;
  let templateId: number;

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

    // Ensure school exists
    const [existingSchool] = await db.select().from(schools).limit(1);
    if (existingSchool) {
      schoolId = existingSchool.id;
    } else {
      const [res] = await db.insert(schools).values({
        name: "Audit Test Academy",
        shortCode: "ATA",
        isActive: true,
      });
      schoolId = Number(res.insertId);
    }

    // Ensure template exists
    const [existingTemplate] = await db.select().from(idCardTemplates).limit(1);
    if (existingTemplate) {
      templateId = existingTemplate.id;
    } else {
      const [tRes] = await db.insert(idCardTemplates).values({
        name: "Audit Test Template",
        status: "ACTIVE",
        accent: "teal",
      });
      templateId = Number(tRes.insertId);
    }

    const pwdHash = await hashPassword("AuditPass123!");
    const adminEmail = `audit_admin_${Date.now()}@test.local`;
    const schoolEmail = `audit_school_${Date.now()}@test.local`;

    await db.insert(users).values({
      openId: `audit_adm_${Date.now()}`,
      email: adminEmail,
      name: "Audit Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });

    await db.insert(users).values({
      openId: `audit_sch_${Date.now()}`,
      email: schoolEmail,
      name: "Audit School User",
      role: "SCHOOL_ADMIN",
      schoolId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });

    const adminLogin = await loginUser(adminEmail, "AuditPass123!");
    if (!adminLogin) throw new Error("Failed to log in as admin");
    adminToken = adminLogin.token;

    const schoolLogin = await loginUser(schoolEmail, "AuditPass123!");
    if (!schoolLogin) throw new Error("Failed to log in as school user");
    schoolToken = schoolLogin.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("Records template selection audit log with template and school details", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ templateId }),
    });

    expect(res.status).toBe(200);

    // Verify GET /api/audit-logs returns enriched information
    const auditRes = await fetch(`${baseUrl}/api/audit-logs?schoolId=${schoolId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.status).toBe(200);
    const logs: any[] = await auditRes.json();

    const selectLog = logs.find((l) => l.action === "SELECT_TEMPLATE" && l.schoolId === schoolId);
    expect(selectLog).toBeDefined();
    expect(selectLog.newValues).toBeDefined();
    expect(selectLog.newValues.templateId).toBe(templateId);
    expect(selectLog.newValues.templateName).toBeTruthy();
    expect(selectLog.schoolName).toBeTruthy();
    expect(selectLog.userName).toBeTruthy();
  });

  it("Records template unselect audit log with previous template info", async () => {
    const res = await fetch(`${baseUrl}/api/schools/${schoolId}/templates/unselect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);

    const auditRes = await fetch(`${baseUrl}/api/audit-logs?schoolId=${schoolId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.status).toBe(200);
    const logs: any[] = await auditRes.json();

    const unselectLog = logs.find((l) => l.action === "UNSELECT_TEMPLATE" && l.schoolId === schoolId);
    expect(unselectLog).toBeDefined();
    expect(unselectLog.newValues).toBeDefined();
    expect(unselectLog.schoolName).toBeTruthy();
  });

  it("Scopes school user audit logs strictly to their own school", async () => {
    const schoolLogsRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${schoolToken}` },
    });
    expect(schoolLogsRes.status).toBe(200);
    const schoolLogs: any[] = await schoolLogsRes.json();

    for (const log of schoolLogs) {
      expect(log.schoolId).toBe(schoolId);
    }
  });
});
