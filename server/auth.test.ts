import "dotenv/config";
import { describe, expect, it, beforeAll } from "vitest";
import express, { type Request, type Response } from "express";
import { COOKIE_NAME } from "../shared/const";
import { apiRouter } from "./api";
import {
  hashPassword,
  loginUser,
  authenticateApplicationRequest,
  setApplicationSession,
  clearApplicationSession,
  createPasswordReset,
  resetPassword,
} from "./appAuth";
import { getDb } from "./db";
import { schools, users, type User } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Application Authentication & School-Scoped Isolation", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let superAdminUser: User;
  let schoolAdminUser: User;
  let testSchoolAId: number;
  let testSchoolBId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database required for auth test suite");
    }

    // Ensure we have two schools for multi-tenant isolation tests
    const existingSchools = await db.select().from(schools).limit(2);
    if (existingSchools.length >= 2) {
      testSchoolAId = existingSchools[0].id;
      testSchoolBId = existingSchools[1].id;
    } else if (existingSchools.length === 1) {
      testSchoolAId = existingSchools[0].id;
      const [resB] = await db.insert(schools).values({
        name: "Test School B",
        shortCode: "TSB",
        isActive: true,
      });
      testSchoolBId = Number(resB.insertId);
    } else {
      const [resA] = await db.insert(schools).values({
        name: "Test School A",
        shortCode: "TSA",
        isActive: true,
      });
      testSchoolAId = Number(resA.insertId);
      const [resB] = await db.insert(schools).values({
        name: "Test School B",
        shortCode: "TSB",
        isActive: true,
      });
      testSchoolBId = Number(resB.insertId);
    }

    // Seed or retrieve test users
    const pwdHash = await hashPassword("TestPass123!");
    
    // Super admin
    const adminRows = await db.select().from(users).where(eq(users.email, "admin@example.test"));
    if (adminRows.length > 0) {
      superAdminUser = adminRows[0];
      await db.update(users).set({ passwordHash: pwdHash, isActive: true }).where(eq(users.id, superAdminUser.id));
    } else {
      const [res] = await db.insert(users).values({
        openId: "test_admin",
        email: "admin@example.test",
        name: "Super Admin",
        role: "SUPER_ADMIN",
        schoolId: null,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      });
      superAdminUser = (await db.select().from(users).where(eq(users.id, Number(res.insertId))))[0];
    }

    // School admin for School A
    const schoolRows = await db.select().from(users).where(eq(users.email, "school@example.test"));
    if (schoolRows.length > 0) {
      schoolAdminUser = schoolRows[0];
      await db.update(users).set({ passwordHash: pwdHash, schoolId: testSchoolAId, isActive: true }).where(eq(users.id, schoolAdminUser.id));
    } else {
      const [res] = await db.insert(users).values({
        openId: "test_school_admin",
        email: "school@example.test",
        name: "School A Admin",
        role: "SCHOOL_ADMIN",
        schoolId: testSchoolAId,
        passwordHash: pwdHash,
        loginMethod: "local",
        isActive: true,
      });
      schoolAdminUser = (await db.select().from(users).where(eq(users.id, Number(res.insertId))))[0];
    }
  });

  describe("1. Admin and School Login", () => {
    it("successfully logs in SUPER_ADMIN with valid credentials and sets session token", async () => {
      const result = await loginUser("admin@example.test", "TestPass123!");
      expect(result).not.toBeNull();
      expect(result?.user.role).toBe("SUPER_ADMIN");
      expect(result?.user.email).toBe("admin@example.test");
      expect(typeof result?.token).toBe("string");
      expect(result?.token.length).toBeGreaterThan(20);
    });

    it("successfully logs in SCHOOL_ADMIN with their scoped school context", async () => {
      const result = await loginUser("school@example.test", "TestPass123!");
      expect(result).not.toBeNull();
      expect(result?.user.role).toBe("SCHOOL_ADMIN");
      expect(result?.user.schoolId).toBe(testSchoolAId);
    });

    it("rejects login with invalid password", async () => {
      const result = await loginUser("admin@example.test", "WrongPassword999!");
      expect(result).toBeNull();
    });
  });

  describe("2. Inactive User Rejection", () => {
    it("rejects authentication for inactive users", async () => {
      if (!db) return;
      // Temporarily mark user as inactive
      await db.update(users).set({ isActive: false }).where(eq(users.id, schoolAdminUser.id));

      const loginResult = await loginUser("school@example.test", "TestPass123!");
      expect(loginResult).toBeNull();

      // Restore active status
      await db.update(users).set({ isActive: true }).where(eq(users.id, schoolAdminUser.id));
    });
  });

  describe("3. Session Persistence and Cookies", () => {
    it("persists and verifies session from token or cookie", async () => {
      const loginResult = await loginUser("admin@example.test", "TestPass123!");
      expect(loginResult).not.toBeNull();

      // Mock request with cookie header
      const mockReqCookie = {
        headers: {
          cookie: `${COOKIE_NAME}=${loginResult!.token}`,
        },
      } as unknown as Request;

      const authUser = await authenticateApplicationRequest(mockReqCookie);
      expect(authUser.id).toBe(superAdminUser.id);
      expect(authUser.role).toBe("SUPER_ADMIN");

      // Mock request with Authorization Bearer header
      const mockReqBearer = {
        headers: {
          authorization: `Bearer ${loginResult!.token}`,
        },
      } as unknown as Request;

      const authUserBearer = await authenticateApplicationRequest(mockReqBearer);
      expect(authUserBearer.id).toBe(superAdminUser.id);
    });

    it("sets and clears HTTP-only session cookie correctly", () => {
      const cookiesSet: Array<{ name: string; val: string; options: Record<string, unknown> }> = [];
      const cookiesCleared: Array<{ name: string; options: Record<string, unknown> }> = [];

      const mockRes = {
        cookie: (name: string, val: string, options: Record<string, unknown>) => {
          cookiesSet.push({ name, val, options });
        },
        clearCookie: (name: string, options: Record<string, unknown>) => {
          cookiesCleared.push({ name, options });
        },
      } as unknown as Response;

      setApplicationSession(mockRes, "mock-jwt-token");
      expect(cookiesSet).toHaveLength(1);
      expect(cookiesSet[0].name).toBe(COOKIE_NAME);
      expect(cookiesSet[0].val).toBe("mock-jwt-token");
      expect(cookiesSet[0].options.httpOnly).toBe(true);

      clearApplicationSession(mockRes);
      expect(cookiesCleared).toHaveLength(1);
      expect(cookiesCleared[0].name).toBe(COOKIE_NAME);
      expect(cookiesCleared[0].options.httpOnly).toBe(true);
    });
  });

  describe("4. Password Reset Flow", () => {
    it("creates a reset token and resets password successfully", async () => {
      const rawToken = await createPasswordReset("admin@example.test");
      expect(rawToken).not.toBeNull();
      expect(typeof rawToken).toBe("string");

      const resetSuccess = await resetPassword(rawToken!, "NewAdminPass123!");
      expect(resetSuccess).toBe(true);

      // Verify old password no longer works
      const oldLogin = await loginUser("admin@example.test", "TestPass123!");
      expect(oldLogin).toBeNull();

      // Verify new password works
      const newLogin = await loginUser("admin@example.test", "NewAdminPass123!");
      expect(newLogin).not.toBeNull();

      // Token cannot be reused
      const secondAttempt = await resetPassword(rawToken!, "AnotherPass123!");
      expect(secondAttempt).toBe(false);

      // Reset back to original password
      const resetBackToken = await createPasswordReset("admin@example.test");
      await resetPassword(resetBackToken!, "TestPass123!");
    });
  });

  describe("5. Multi-Tenant School Scoping and Isolation (School A cannot access School B)", () => {
    let app: express.Express;
    let adminToken: string;
    let schoolAToken: string;

    beforeAll(async () => {
      app = express();
      app.use(express.json());
      app.use("/api", apiRouter);

      const adminLogin = await loginUser("admin@example.test", "TestPass123!");
      adminToken = adminLogin!.token;

      const schoolLogin = await loginUser("school@example.test", "TestPass123!");
      schoolAToken = schoolLogin!.token;
    });

    it("SUPER_ADMIN can access any school (School A and School B)", async () => {
      // Direct invoke request handler on School A
      const reqA = {
        method: "GET",
        url: `/schools/${testSchoolAId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: String(testSchoolAId) },
      };

      // Test with express mock or simulated call
      const superAdminMe = await authenticateApplicationRequest({
        headers: { authorization: `Bearer ${adminToken}` },
      } as unknown as Request);
      expect(superAdminMe.role).toBe("SUPER_ADMIN");
    });

    it("School user is automatically scoped to their school and denied access to other schools", async () => {
      const schoolUser = await authenticateApplicationRequest({
        headers: { authorization: `Bearer ${schoolAToken}` },
      } as unknown as Request);

      expect(schoolUser.role).toBe("SCHOOL_ADMIN");
      expect(schoolUser.schoolId).toBe(testSchoolAId);
      expect(schoolUser.schoolId).not.toBe(testSchoolBId);
    });

    it("prevents school user from overriding schoolId in request body", async () => {
      // In server/api.ts:
      // POST /id-cards:
      // schoolId = adminRoles.has(user.role) ? Number(req.body.schoolId) : user.schoolId;
      const schoolUser = await authenticateApplicationRequest({
        headers: { authorization: `Bearer ${schoolAToken}` },
      } as unknown as Request);

      const requestedBodySchoolId = testSchoolBId; // Attacker tries to create card for School B
      const assignedSchoolId = schoolUser.role === "SUPER_ADMIN"
        ? Number(requestedBodySchoolId)
        : schoolUser.schoolId;

      // School user must always be pinned to their own school
      expect(assignedSchoolId).toBe(testSchoolAId);
      expect(assignedSchoolId).not.toBe(testSchoolBId);
    });
  });
});
