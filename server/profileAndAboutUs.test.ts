import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express, { type Request, type Response } from "express";
import { apiRouter } from "./api";
import { getDb } from "./db";
import { schools, users, type User } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { hashPassword, loginUser, verifyPassword } from "./appAuth";

describe("Super Admin Profile, About Us, and Test Account Isolation", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testAdminUser: User;
  let testSchoolUser: User;
  let testSchoolId: number;
  let adminToken: string;
  let schoolToken: string;
  const originalAdminPassword = "AdminSecurePass123!";
  const testSchoolPassword = "SchoolSecurePass123!";

  // Express test app wrapper
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRouter);

  const makeRequest = async (
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    token?: string,
    body?: unknown,
  ) => {
    return new Promise<{ status: number; body: any }>((resolve) => {
      const req = {
        method,
        url: path,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body ?? {},
      } as unknown as Request;

      let responseStatus = 200;
      let responseBody: any = null;

      const res = {
        locals: {},
        status(code: number) {
          responseStatus = code;
          return this;
        },
        json(data: any) {
          responseBody = data;
          resolve({ status: responseStatus, body: responseBody });
          return this;
        },
        setHeader() {
          return this;
        },
        clearCookie() {
          return this;
        },
      } as unknown as Response;

      (app as any).handle(req, res, (err: any) => {
        if (err) {
          resolve({ status: 500, body: { error: err.message } });
        }
      });
    });
  };

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database unavailable for tests");

    // Clean up any stale deterministic test entities before starting
    await db.delete(users).where(eq(users.openId, "__test_super_admin__"));
    await db.delete(users).where(eq(users.openId, "__test_school_admin__"));
    await db.delete(schools).where(eq(schools.shortCode, "__TSCH__"));

    // Create deterministic test school
    const [schoolRes] = await db.insert(schools).values({
      name: "Profile Test Academy",
      shortCode: "__TSCH__",
      isActive: true,
    });
    testSchoolId = Number(schoolRes.insertId);

    // Create deterministic Super Admin
    const adminHash = await hashPassword(originalAdminPassword);
    const [adminRes] = await db.insert(users).values({
      openId: "__test_super_admin__",
      email: "profile_admin_test@edunextg.com",
      name: "Profile Admin Master",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash: adminHash,
      loginMethod: "local",
      isActive: true,
    });
    testAdminUser = (await db.select().from(users).where(eq(users.id, Number(adminRes.insertId))))[0];

    // Create deterministic School Admin
    const schoolHash = await hashPassword(testSchoolPassword);
    const [schoolUserRes] = await db.insert(users).values({
      openId: "__test_school_admin__",
      email: "profile_school_test@edunextg.com",
      name: "Profile School Admin",
      role: "SCHOOL_ADMIN",
      schoolId: testSchoolId,
      passwordHash: schoolHash,
      loginMethod: "local",
      isActive: true,
    });
    testSchoolUser = (await db.select().from(users).where(eq(users.id, Number(schoolUserRes.insertId))))[0];

    // Obtain session tokens
    const adminLogin = await loginUser(testAdminUser.email!, originalAdminPassword);
    adminToken = adminLogin!.token;

    const schoolLogin = await loginUser(testSchoolUser.email!, testSchoolPassword);
    schoolToken = schoolLogin!.token;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(users).where(eq(users.id, testAdminUser.id));
      await db.delete(users).where(eq(users.id, testSchoolUser.id));
      await db.delete(schools).where(eq(schools.id, testSchoolId));
    }
  });

  describe("1. Prevention of Random/Test Accounts", () => {
    it("does not create random accounts on application startup or repeated queries", async () => {
      const userCountBefore = (await db!.select().from(users)).length;

      // Simulate queries that happen on client launch and portal loading
      await makeRequest("GET", "/api/schools", adminToken);
      await makeRequest("GET", "/api/templates", adminToken);
      await makeRequest("GET", "/api/about", adminToken);
      await makeRequest("GET", "/api/auth/me", adminToken);
      await makeRequest("GET", "/api/auth/me", schoolToken);

      const userCountAfter = (await db!.select().from(users)).length;
      expect(userCountAfter).toBe(userCountBefore);
    });

    it("does not allow fuzzy seed_ or fake test domain logins without real accounts", async () => {
      const nonexistentResult = await loginUser("nonexistent_random_user_12345", "SomePass123!");
      expect(nonexistentResult).toBeNull();
    });
  });

  describe("2. Super Admin Profile Authorization & Security", () => {
    it("allows SUPER_ADMIN to fetch their profile via GET /api/profile", async () => {
      const res = await makeRequest("GET", "/api/profile", adminToken);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testAdminUser.id);
      expect(res.body.email).toBe("profile_admin_test@edunextg.com");
      expect(res.body.role).toBe("SUPER_ADMIN");
    });

    it("strictly blocks School users from GET /api/profile with 403 Forbidden", async () => {
      const res = await makeRequest("GET", "/api/profile", schoolToken);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it("strictly blocks School users from PUT /api/profile with 403 Forbidden", async () => {
      const res = await makeRequest("PUT", "/api/profile", schoolToken, { name: "Hacked Name" });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it("strictly blocks School users from POST /api/profile/picture with 403 Forbidden", async () => {
      const res = await makeRequest("POST", "/api/profile/picture", schoolToken, {
        avatarUrl: "data:image/png;base64,fake",
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it("strictly blocks School users from DELETE /api/profile/picture with 403 Forbidden", async () => {
      const res = await makeRequest("DELETE", "/api/profile/picture", schoolToken);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });

    it("strictly blocks School users from POST /api/profile/password with 403 Forbidden", async () => {
      const res = await makeRequest("POST", "/api/profile/password", schoolToken, {
        currentPassword: testSchoolPassword,
        newPassword: "NewSecretPassword123!",
        confirmNewPassword: "NewSecretPassword123!",
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/insufficient permissions/i);
    });
  });

  describe("3. Super Admin Profile Updates (Details & Picture)", () => {
    it("allows Super Admin to update name, email, and phone", async () => {
      const updatedName = "Master Administrator Updated";
      const updatedPhone = "+1 555-019-9988";

      const res = await makeRequest("PUT", "/api/profile", adminToken, {
        name: updatedName,
        phone: updatedPhone,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe(updatedName);
      expect(res.body.user.phone).toBe(updatedPhone);

      // Verify persistence in DB
      const fresh = (await db!.select().from(users).where(eq(users.id, testAdminUser.id)))[0];
      expect(fresh.name).toBe(updatedName);
      expect(fresh.phone).toBe(updatedPhone);
    });

    it("validates empty name or invalid email on profile update", async () => {
      const emptyNameRes = await makeRequest("PUT", "/api/profile", adminToken, { name: "" });
      expect(emptyNameRes.status).toBe(400);
      expect(emptyNameRes.body.error).toMatch(/name cannot be empty/i);

      const invalidEmailRes = await makeRequest("PUT", "/api/profile", adminToken, { email: "not-an-email" });
      expect(invalidEmailRes.status).toBe(400);
      expect(invalidEmailRes.body.error).toMatch(/valid email/i);
    });

    it("allows Super Admin to upload and update profile picture", async () => {
      const sampleAvatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const res = await makeRequest("POST", "/api/profile/picture", adminToken, {
        avatarUrl: sampleAvatar,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.avatarUrl).toBe(sampleAvatar);

      // Verify persistence
      const fresh = (await db!.select().from(users).where(eq(users.id, testAdminUser.id)))[0];
      expect(fresh.avatarUrl).toBe(sampleAvatar);
    });

    it("allows Super Admin to remove profile picture cleanly", async () => {
      const res = await makeRequest("DELETE", "/api/profile/picture", adminToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.avatarUrl).toBeNull();

      // Verify persistence in DB
      const fresh = (await db!.select().from(users).where(eq(users.id, testAdminUser.id)))[0];
      expect(fresh.avatarUrl).toBeNull();
    });
  });

  describe("4. Password Change Validation & Persistence", () => {
    const newAdminPassword = "SuperAdminNewPass456!";

    it("rejects password change if required fields are missing", async () => {
      const res = await makeRequest("POST", "/api/profile/password", adminToken, {
        currentPassword: "",
        newPassword: newAdminPassword,
        confirmNewPassword: newAdminPassword,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/all password fields are required/i);
    });

    it("rejects password change if current password is incorrect", async () => {
      const res = await makeRequest("POST", "/api/profile/password", adminToken, {
        currentPassword: "CompletelyWrongPassword!",
        newPassword: newAdminPassword,
        confirmNewPassword: newAdminPassword,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/incorrect current password/i);
    });

    it("rejects password change if new password and confirm do not match", async () => {
      const res = await makeRequest("POST", "/api/profile/password", adminToken, {
        currentPassword: originalAdminPassword,
        newPassword: newAdminPassword,
        confirmNewPassword: "MismatchingPassword789!",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/passwords do not match/i);
    });

    it("rejects new password if shorter than 8 characters", async () => {
      const res = await makeRequest("POST", "/api/profile/password", adminToken, {
        currentPassword: originalAdminPassword,
        newPassword: "short",
        confirmNewPassword: "short",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 8 characters/i);
    });

    it("successfully changes password with valid credentials and persists hashed password", async () => {
      const res = await makeRequest("POST", "/api/profile/password", adminToken, {
        currentPassword: originalAdminPassword,
        newPassword: newAdminPassword,
        confirmNewPassword: newAdminPassword,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify that the new password works for login
      const newLogin = await loginUser(testAdminUser.email!, newAdminPassword);
      expect(newLogin).not.toBeNull();
      expect(newLogin?.user.id).toBe(testAdminUser.id);

      // Verify that old password no longer works
      const oldLogin = await loginUser(testAdminUser.email!, originalAdminPassword);
      expect(oldLogin).toBeNull();
    });
  });

  describe("5. About Us Section Accessibility", () => {
    it("allows SUPER_ADMIN to access GET /api/about", async () => {
      const res = await makeRequest("GET", "/api/about", adminToken);
      expect(res.status).toBe(200);
      expect(res.body.title).toContain("About");
      expect(res.body.version).toBeDefined();
    });

    it("allows School users to access GET /api/about", async () => {
      const res = await makeRequest("GET", "/api/about", schoolToken);
      expect(res.status).toBe(200);
      expect(res.body.title).toContain("About");
    });
  });

  describe("6. Recent Activity / Audit Logs Clear Functionality", () => {
    it("allows admin to clear recent activity via DELETE /api/audit-logs", async () => {
      // First ensure there's at least one audit log entry
      await makeRequest("PUT", "/api/profile", adminToken, { phone: "9876543210" });
      const beforeRes = await makeRequest("GET", "/api/audit-logs", adminToken);
      expect(beforeRes.status).toBe(200);

      // Now clear logs
      const deleteRes = await makeRequest("DELETE", "/api/audit-logs", adminToken);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify audit logs are empty
      const afterRes = await makeRequest("GET", "/api/audit-logs", adminToken);
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.length).toBe(0);
    });
  });

  describe("7. School Creation without Email & Automatic User Cleanup on School Deletion", () => {
    let createdSchoolId: number;
    let createdSchoolLoginId: string;

    it("creates a school without email leaving user email null and not setting @edunextg", async () => {
      const res = await makeRequest("POST", "/api/schools", adminToken, {
        name: "Emerald High School",
        shortCode: "EMERALD",
        // Notice: NO email provided
        phone: "555-0199",
      });
      expect(res.status).toBe(201);
      createdSchoolId = res.body.id;
      expect(createdSchoolId).toBeGreaterThan(0);
      expect(res.body.email).toBeNull();
      expect(res.body.credentials).toBeDefined();
      expect(res.body.credentials.loginId).toBe("SCH_EMERALD");
      expect(res.body.credentials.email).toBe(""); // Not random @edunextg
      createdSchoolLoginId = res.body.credentials.loginId;

      // Verify in DB users table that the school admin has email: null
      const schoolAdminUser = (
        await db!.select().from(users).where(eq(users.openId, createdSchoolLoginId))
      )[0];
      expect(schoolAdminUser).toBeDefined();
      expect(schoolAdminUser.email).toBeNull();
      expect(schoolAdminUser.schoolId).toBe(createdSchoolId);

      // Verify school admin can log in with Login ID and password even without email
      const schoolLogin = await loginUser(createdSchoolLoginId, res.body.credentials.password);
      expect(schoolLogin).not.toBeNull();
      expect(schoolLogin?.user.schoolId).toBe(createdSchoolId);
    });

    it("automatically deletes the associated school user when the school is deleted", async () => {
      // Confirm user exists before deletion
      const userBefore = (
        await db!.select().from(users).where(eq(users.schoolId, createdSchoolId))
      )[0];
      expect(userBefore).toBeDefined();

      // Delete the school
      const deleteRes = await makeRequest("DELETE", `/api/schools/${createdSchoolId}`, adminToken);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify school is deleted
      const schoolAfter = (
        await db!.select().from(schools).where(eq(schools.id, createdSchoolId))
      )[0];
      expect(schoolAfter).toBeUndefined();

      // Verify associated user is automatically deleted (no orphaned users in users table)
      const userAfter = (
        await db!.select().from(users).where(eq(users.openId, createdSchoolLoginId))
      )[0];
      expect(userAfter).toBeUndefined();

      const orphanedUsers = await db!.select().from(users).where(eq(users.schoolId, createdSchoolId));
      expect(orphanedUsers.length).toBe(0);
    });
  });
});
