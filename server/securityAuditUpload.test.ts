import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import { eq } from "drizzle-orm";
import { apiRouter } from "./api";
import { getDb } from "./db";
import { auditLogs, schools, users, type User } from "../drizzle/schema";
import { hashPassword, loginUser } from "./appAuth";

describe("Security, Upload Hardening, Audit Log Restrictions & Migration Consistency", () => {
  let server: http.Server;
  let baseUrl: string;

  let adminToken: string;
  let schoolAToken: string;
  let schoolBToken: string;
  let viewerToken: string;
  let operatorToken: string;

  let schoolAId: number;
  let schoolBId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection required for test suite");

    const app = express();
    app.use(express.json({ limit: "20mb" }));
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

    const testPassword = "SecurityTestPass123!";
    const pwdHash = await hashPassword(testPassword);

    // Setup Test School A
    const [resA] = await db.insert(schools).values({
      name: "Security Test School A",
      shortCode: `SECA_${Date.now().toString().slice(-4)}`,
      isActive: true,
    });
    schoolAId = Number(resA.insertId);

    // Setup Test School B
    const [resB] = await db.insert(schools).values({
      name: "Security Test School B",
      shortCode: `SECB_${Date.now().toString().slice(-4)}`,
      isActive: true,
    });
    schoolBId = Number(resB.insertId);

    // Setup Super Admin User
    const adminEmail = `sec_admin_${Date.now()}@test.local`;
    await db.insert(users).values({
      openId: `sec_admin_${Date.now()}`,
      email: adminEmail,
      name: "Security Super Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const adminLogin = await loginUser(adminEmail, testPassword);
    adminToken = adminLogin!.token;

    // Setup School A Admin
    const schoolAAdminEmail = `school_a_admin_${Date.now()}@test.local`;
    await db.insert(users).values({
      openId: `school_a_admin_${Date.now()}`,
      email: schoolAAdminEmail,
      name: "School A Admin",
      role: "SCHOOL_ADMIN",
      schoolId: schoolAId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const schoolALogin = await loginUser(schoolAAdminEmail, testPassword);
    schoolAToken = schoolALogin!.token;

    // Setup School B Admin
    const schoolBAdminEmail = `school_b_admin_${Date.now()}@test.local`;
    await db.insert(users).values({
      openId: `school_b_admin_${Date.now()}`,
      email: schoolBAdminEmail,
      name: "School B Admin",
      role: "SCHOOL_ADMIN",
      schoolId: schoolBId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const schoolBLogin = await loginUser(schoolBAdminEmail, testPassword);
    schoolBToken = schoolBLogin!.token;

    // Setup School Operator (School A)
    const operatorEmail = `operator_a_${Date.now()}@test.local`;
    await db.insert(users).values({
      openId: `operator_a_${Date.now()}`,
      email: operatorEmail,
      name: "School A Operator",
      role: "SCHOOL_OPERATOR",
      schoolId: schoolAId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const operatorLogin = await loginUser(operatorEmail, testPassword);
    operatorToken = operatorLogin!.token;

    // Setup Viewer User (School A)
    const viewerEmail = `viewer_a_${Date.now()}@test.local`;
    await db.insert(users).values({
      openId: `viewer_a_${Date.now()}`,
      email: viewerEmail,
      name: "School A Viewer",
      role: "VIEWER",
      schoolId: schoolAId,
      passwordHash: pwdHash,
      loginMethod: "local",
      isActive: true,
    });
    const viewerLogin = await loginUser(viewerEmail, testPassword);
    viewerToken = viewerLogin!.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const db = await getDb();
    if (db) {
      await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolAId));
      await db.delete(auditLogs).where(eq(auditLogs.schoolId, schoolBId));
      await db.delete(schools).where(eq(schools.id, schoolAId));
      await db.delete(schools).where(eq(schools.id, schoolBId));
    }
  });

  // 1. Audit Log Deletion Authorization
  describe("1. Audit Log Deletion Server-Side Authorization", () => {
    it("rejects unauthenticated audit-log deletion with 401", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Authentication required");
    });

    it("rejects SCHOOL_ADMIN from deleting audit logs with 403", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${schoolAToken}` },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/insufficient permissions/i);
    });

    it("rejects SCHOOL_OPERATOR from deleting audit logs with 403", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${operatorToken}` },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/insufficient permissions/i);
    });

    it("rejects VIEWER from deleting audit logs with 403", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/insufficient permissions/i);
    });

    it("allows SUPER_ADMIN to delete/clear audit logs with 200", async () => {
      // Seed an audit log entry
      const db = await getDb();
      await db!.insert(auditLogs).values({
        schoolId: schoolAId,
        action: "TEST_SECURITY_ACTION",
        entityType: "test",
      });

      const res = await fetch(`${baseUrl}/api/audit-logs?schoolId=${schoolAId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // 2. Upload Endpoint Authentication & Authorization
  describe("2. Upload Endpoint Authentication & Role Authorization", () => {
    // 1x1 transparent PNG valid base64
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    it("rejects unauthenticated POST /api/upload with 401", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "test.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Authentication required");
    });

    it("rejects VIEWER from uploading files with 403", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${viewerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "student_photo.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/insufficient permissions/i);
    });

    it("allows SCHOOL_ADMIN to upload a valid image", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${schoolAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "student_photo.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toBeDefined();
    });

    it("allows SCHOOL_OPERATOR to upload a valid image", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${operatorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "signature.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toBeDefined();
    });

    it("allows SUPER_ADMIN to upload a valid image", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "template_bg.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toBeDefined();
    });
  });

  // 3. Upload File Validation (Magic Bytes, Size, Content-Type)
  describe("3. Safe Upload File Validation (Magic Bytes & Size Enforcement)", () => {
    it("rejects malicious text/HTML pretending to be an image (PNG extension & MIME)", async () => {
      const maliciousHtml = Buffer.from("<script>alert('xss')</script>").toString("base64");
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "photo.png",
          contentType: "image/png",
          dataBase64: maliciousHtml,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/only png, jpeg, webp, and gif images are allowed/i);
    });

    it("rejects binary executable masquerading as an image", async () => {
      // MZ header for Windows EXE / DOS
      const fakeExe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff").toString("base64");
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "malicious.exe",
          contentType: "image/png",
          dataBase64: fakeExe,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/only png, jpeg, webp, and gif images are allowed/i);
    });

    it("rejects non-image contentType header even if payload is image", async () => {
      const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "payload.sh",
          contentType: "application/x-sh",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/only image uploads are allowed/i);
    });

    it("rejects oversized file exceeding 5MB limit", async () => {
      // Allocate 5.5MB buffer with valid PNG magic bytes at the start
      const bigBuffer = Buffer.alloc(5.5 * 1024 * 1024);
      // Valid PNG header
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]).copy(bigBuffer, 0);

      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "huge.png",
          contentType: "image/png",
          dataBase64: bigBuffer.toString("base64"),
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/exceeds 5mb size limit/i);
    });

    it("accepts valid JPEG image via magic bytes check", async () => {
      // JPEG header: FF D8 FF E0 00 10 4A 46 49 46 00 01
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01]);
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "valid.jpg",
          contentType: "image/jpeg",
          dataBase64: jpegBuffer.toString("base64"),
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  // 4. Cross-School Tenant Isolation on Uploads
  describe("4. Multi-Tenant School Isolation on Uploads", () => {
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    it("blocks School A user attempting to upload for School B", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${schoolAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId: schoolBId,
          filename: "cross_school.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("School access denied");
    });

    it("allows School A user to upload when matching their own school", async () => {
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${schoolAToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId: schoolAId,
          filename: "own_school.png",
          contentType: "image/png",
          dataBase64: validPngBase64,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toBeDefined();
    });
  });

  // 5. Database Migration Directory Consistency
  describe("5. Drizzle Migration Directory Consistency", () => {
    const drizzleDir = path.resolve(process.cwd(), "drizzle");
    const journalPath = path.resolve(drizzleDir, "meta", "_journal.json");

    it("ensures _journal.json exists and is valid JSON", () => {
      expect(fs.existsSync(journalPath)).toBe(true);
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      expect(Array.isArray(journal.entries)).toBe(true);
      expect(journal.entries.length).toBeGreaterThan(0);
    });

    it("ensures migration sequence is strictly sequential with no duplicate indices", () => {
      const sqlFiles = fs.readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
      const prefixes = sqlFiles.map((f) => f.split("_")[0]);

      // Check unique prefixes
      const uniquePrefixes = new Set(prefixes);
      expect(uniquePrefixes.size).toBe(sqlFiles.length);

      // Check that each prefix is a 4-digit number
      prefixes.forEach((p) => {
        expect(p).toMatch(/^\d{4}$/);
      });

      // Check sequential indices
      const sortedPrefixes = [...prefixes].sort();
      sortedPrefixes.forEach((p, index) => {
        const expected = String(index).padStart(4, "0");
        expect(p).toBe(expected);
      });
    });

    it("ensures every SQL migration file corresponds to an entry in _journal.json", () => {
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const journalTags = new Set(journal.entries.map((e: { tag: string }) => e.tag));

      const sqlFiles = fs.readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
      sqlFiles.forEach((file) => {
        const tag = file.replace(/\.sql$/, "");
        expect(journalTags.has(tag)).toBe(true);
      });
    });

    it("ensures no orphaned migration SQL files exist in drizzle/", () => {
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const journalFileNames = new Set(journal.entries.map((e: { tag: string }) => `${e.tag}.sql`));

      const sqlFiles = fs.readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
      sqlFiles.forEach((file) => {
        expect(journalFileNames.has(file)).toBe(true);
      });
      expect(sqlFiles.length).toBe(journal.entries.length);
    });
  });
});
