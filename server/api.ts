import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardFiles,
  idCardRequests,
  idCardTemplates,
  idCards,
  notifications,
  passwordResets,
  schoolTemplates,
  templateElements,
  schools,
  users,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { authenticateApplicationRequest, clearApplicationSession, createPasswordReset, hashPassword, loginUser, resetPassword, setApplicationSession, signApplicationSession, verifyPassword } from "./appAuth";
import { generateSingleCardPdf, generateBulkCardPdf, type CardPdfData } from "./pdf";

const router = Router();
const adminRoles = new Set(["SUPER_ADMIN"]);
const schoolManagerRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
const schoolWriteRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "SCHOOL_OPERATOR"]);

function detectImageMimeType(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | "image/gif" | null {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function currentUser(res: Response) {
  return res.locals.user as User;
}
function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeTemplateElement<T extends { config: unknown }>(element: T) {
  return { ...element, config: parseJsonColumn(element.config) };
}

function canManageSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (schoolManagerRoles.has(user.role) && user.schoolId === schoolId);
}
function canWriteSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (schoolWriteRoles.has(user.role) && user.schoolId === schoolId);
}

function canReadSchool(user: User, schoolId?: number) {
  return adminRoles.has(user.role) || (user.schoolId !== null && user.schoolId === schoolId);
}

function requestedSchoolId(user: User, value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return adminRoles.has(user.role) ? id : user.schoolId === id ? id : null;
}

async function audit(user: User, action: string, entityType: string, entityId: number | null, schoolId: number | null, newValues?: unknown) {
  const db = await getDb();
  if (!db) return;
  try {
    let validSchoolId = schoolId;
    if (validSchoolId) {
      const [exists] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, validSchoolId)).limit(1);
      if (!exists) validSchoolId = null;
    }
    await db.insert(auditLogs).values({
      userId: user.id > 0 ? user.id : null,
      schoolId: validSchoolId,
      action,
      entityType,
      entityId,
      newValues: newValues as never,
    });
  } catch (err) {
    console.warn("[Audit] Could not record audit log:", err);
  }
}

async function notify(userId: number, schoolId: number | null, type: string, title: string, message: string, entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(notifications).values({ userId, schoolId, type, title, message, entityType, entityId });
  } catch (err) {
    console.warn("[Notification] Could not deliver notification:", err);
  }
}

async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateApplicationRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.locals.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
}

function requireRole(roles: Set<string>) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.has(currentUser(res).role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

function fail(res: Response, error: unknown) {
  console.error("[API]", error);
  // In production, avoid leaking internal error details to the client
  const isProduction = process.env.NODE_ENV === "production";
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Database operation failed";
  const message = isProduction ? "An internal error occurred. Please try again or contact support." : rawMessage;
  return res.status(500).json({ error: message });
}

router.post("/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.username ?? req.body.email ?? "").trim();
    const password = String(req.body.password ?? "");
    if (!identifier || password.length < 8) return res.status(400).json({ error: "Valid username/email and password are required" });
    const result = await loginUser(identifier, password);
    if (!result) return res.status(401).json({ error: "Invalid username or password" });
    setApplicationSession(res, result.token);
    const { passwordHash: _passwordHash, ...safeUser } = result.user;
    const db = await getDb();
    const school = safeUser.schoolId && db ? (await db.select({ name: schools.name }).from(schools).where(eq(schools.id, safeUser.schoolId)))[0] : undefined;
    res.json({ user: { ...safeUser, schoolName: school?.name ?? null }, token: result.token });
  } catch (e: any) {
    if (e?.isSchoolInactive) {
      return res.status(403).json({ error: e.message });
    }
    fail(res, e);
  }
});
router.post("/auth/logout", (_req, res) => { clearApplicationSession(res); res.json({ success: true }); });
router.get("/auth/me", async (req, res) => {
  try {
    const user = await authenticateApplicationRequest(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    const db = await getDb();
    const school = safeUser.schoolId && db ? (await db.select({ name: schools.name }).from(schools).where(eq(schools.id, safeUser.schoolId)))[0] : undefined;
    res.json({ ...safeUser, schoolName: school?.name ?? null });
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
});
router.post("/auth/forgot-password", async (req, res) => { try { const email = String(req.body.email ?? "").trim().toLowerCase(); if (!email) return res.status(400).json({ error: "Email is required" }); const token = await createPasswordReset(email); res.json({ success: true, ...(ENV.isProduction || !token ? {} : { developmentResetToken: token }) }); } catch (e) { fail(res, e); } });
router.post("/auth/reset-password", async (req, res) => { try { const token = String(req.body.token ?? ""); const password = String(req.body.password ?? ""); if (!token || password.length < 8) return res.status(400).json({ error: "Token and a password of at least 8 characters are required" }); const success = await resetPassword(token, password); if (!success) return res.status(400).json({ error: "Invalid or expired reset token" }); res.json({ success: true }); } catch (e) { fail(res, e); } });

router.use(auth);

// --- About Us ---------------------------------------------------------------
router.get("/about", async (_req, res) => {
  res.json({
    title: "About Insight Education & EduNextG",
    version: "2.4.0",
    description: "Enterprise Multi-Tenant School ID Card Issuance, Dynamic Template Design, & Verification Platform.",
  });
});

// --- SUPER_ADMIN Profile Management -----------------------------------------
router.get("/profile", requireRole(adminRoles), async (_req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const freshUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!freshUser) return res.status(404).json({ error: "User not found" });
    res.json(safeUser(freshUser));
  } catch (e) {
    console.error("[Profile GET Error]", e);
    res.status(500).json({ error: "Unable to load profile. Please try again." });
  }
});

router.put("/profile", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;
    const phone = req.body.phone !== undefined ? String(req.body.phone).trim() : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ error: "Name cannot be empty." });
    }

    if (email !== undefined) {
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      const existing = (
        await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email), ne(users.id, user.id)))
      )[0];
      if (existing) {
        return res.status(400).json({ error: "Email is already in use by another account." });
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone || null;

    await db.update(users).set(updates).where(eq(users.id, user.id));
    await audit(user, "UPDATE_PROFILE", "user", user.id, null, { name, email, phone });

    const updated = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: safeUser(updated),
    });
  } catch (e) {
    console.error("[Profile PUT Error]", e);
    res.status(500).json({ error: "Unable to update profile. Please try again." });
  }
});

router.post("/profile/picture", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl).trim() : null;
    if (!avatarUrl) {
      return res.status(400).json({ error: "Please provide a valid profile image." });
    }

    await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user, "UPDATE_PROFILE_PICTURE", "user", user.id, null, null);

    res.json({
      success: true,
      message: "Profile picture updated successfully.",
      avatarUrl,
    });
  } catch (e) {
    console.error("[Profile Picture Error]", e);
    res.status(500).json({ error: "Unable to update profile picture. Please try again." });
  }
});

router.delete("/profile/picture", requireRole(adminRoles), async (_req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    await db.update(users).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(user, "REMOVE_PROFILE_PICTURE", "user", user.id, null, null);

    res.json({
      success: true,
      message: "Profile picture removed successfully.",
      avatarUrl: null,
    });
  } catch (e) {
    console.error("[Profile Picture Remove Error]", e);
    res.status(500).json({ error: "Unable to remove profile picture. Please try again." });
  }
});

router.post("/profile/password", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = String(req.body.newPassword ?? "");
    const confirmNewPassword = String(req.body.confirmNewPassword ?? req.body.confirmPassword ?? "");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: "All password fields are required." });
    }

    const freshUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    if (!freshUser || !freshUser.passwordHash) {
      return res.status(404).json({ error: "User account unavailable." });
    }

    const isCurrentValid = await verifyPassword(currentPassword, freshUser.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long." });
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    // Invalidate any unexpired password reset tokens for this user
    await db.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
    await audit(user, "CHANGE_PASSWORD", "user", user.id, null, null);

    // Fetch the updated user and sign a fresh session token
    const refreshedUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
    const newToken = await signApplicationSession(refreshedUser ?? { ...user, passwordHash: newHash });
    await setApplicationSession(res, newToken);

    res.json({
      success: true,
      message: "Password changed successfully.",
      token: newToken,
    });
  } catch (e) {
    console.error("[Profile Password Error]", e);
    res.status(500).json({ error: "Unable to change password. Please try again." });
  }
});

async function attachSchoolTemplateMeta(db: any, schoolList: any[]) {
  if (!schoolList.length) return [];
  const defaultTemplates = await db
    .select({
      schoolId: schoolTemplates.schoolId,
      templateId: schoolTemplates.templateId,
      isDefault: schoolTemplates.isDefault,
      templateName: idCardTemplates.name,
      accent: idCardTemplates.accent,
      orientation: idCardTemplates.orientation,
      status: idCardTemplates.status,
    })
    .from(schoolTemplates)
    .innerJoin(idCardTemplates, eq(schoolTemplates.templateId, idCardTemplates.id))
    .where(eq(schoolTemplates.isDefault, true));

  const templateMap = new Map<number, (typeof defaultTemplates)[0]>();
  for (const dt of defaultTemplates) {
    templateMap.set(dt.schoolId, dt);
  }

  return schoolList.map((s) => {
    const tmpl = templateMap.get(s.id);
    return {
      ...s,
      selectedTemplateId: tmpl?.templateId ?? null,
      selectedTemplateName: tmpl?.templateName ?? null,
      templateSelectionStatus: tmpl ? ("Selected" as const) : ("Not Selected" as const),
      selectedTemplate: tmpl
        ? {
            id: tmpl.templateId,
            name: tmpl.templateName,
            accent: tmpl.accent,
            orientation: tmpl.orientation,
            status: tmpl.status,
          }
        : null,
    };
  });
}

router.get("/schools", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    const rows = adminRoles.has(user.role)
      ? await db.select().from(schools).orderBy(desc(schools.createdAt))
      : user.schoolId
      ? await db.select().from(schools).where(eq(schools.id, user.schoolId))
      : [];
    const enriched = await attachSchoolTemplateMeta(db, rows);
    res.json(enriched);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/schools", requireRole(adminRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const shortCode = String(req.body.shortCode).trim();
    if (!shortCode) return res.status(400).json({ error: "shortCode is required" });

    let createdSchool: any;
    let credentials: any;

    await db.transaction(async (tx) => {
      const result = await tx.insert(schools).values({
        name: String(req.body.name).trim(),
        shortCode,
        email: req.body.email ?? null,
        phone: req.body.phone ?? null,
        address: req.body.address ?? null,
      });
      const id = Number(result[0].insertId);

      // Auto-generate Login ID and ID Pass / Password for newly created school
      const cleanCode = shortCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || `SCH${id}`;
      let loginId = req.body.loginId && String(req.body.loginId).trim()
        ? String(req.body.loginId).trim()
        : `SCH_${cleanCode}`;

      // Ensure loginId uniqueness in users.openId
      const existingOpenId = (await tx.select({ id: users.id }).from(users).where(eq(users.openId, loginId)))[0];
      if (existingOpenId) {
        loginId = `SCH_${cleanCode}_${id}`;
      }

      const rawPassword = req.body.password && String(req.body.password).length >= 8
        ? String(req.body.password)
        : `Pass@${cleanCode}${Math.floor(1000 + Math.random() * 9000)}`;

      const userEmail = req.body.email && String(req.body.email).trim()
        ? String(req.body.email).trim()
        : null;

      const passwordHash = await hashPassword(rawPassword);

      await tx.insert(users).values({
        openId: loginId,
        name: `${String(req.body.name).trim()} Administrator`,
        email: userEmail,
        passwordHash,
        loginMethod: "local",
        role: "SCHOOL_ADMIN",
        schoolId: id,
        isActive: true,
      });

      await tx.insert(auditLogs).values({
        userId: currentUser(res).id > 0 ? currentUser(res).id : null,
        schoolId: id,
        action: "CREATE_SCHOOL",
        entityType: "school",
        entityId: id,
        newValues: req.body as never,
      });

      createdSchool = (await tx.select().from(schools).where(eq(schools.id, id)))[0];
      credentials = {
        loginId,
        email: userEmail ?? "",
        password: rawPassword,
      };
    });

    const withTemplate = (await attachSchoolTemplateMeta(db, [createdSchool]))[0];

    res.status(201).json({
      ...withTemplate,
      credentials,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/schools/:id/credentials", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const school = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!school) return res.status(404).json({ error: "School not found" });

    const cleanCode = school.shortCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || `SCH${id}`;
    let loginId = `SCH_${cleanCode}`;
    const rawPassword = req.body.password && String(req.body.password).length >= 8
      ? String(req.body.password)
      : `Pass@${cleanCode}${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await hashPassword(rawPassword);

    // Find existing SCHOOL_ADMIN user for this school, or create one
    const existingUser = (
      await db
        .select()
        .from(users)
        .where(and(eq(users.schoolId, id), eq(users.role, "SCHOOL_ADMIN")))
    )[0];

    let userEmail = school.email && String(school.email).trim() ? String(school.email).trim() : null;

    if (existingUser) {
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, existingUser.id));
      loginId = existingUser.openId;
      userEmail = existingUser.email ?? userEmail;
    } else {
      const existingWithOpenId = (await db.select({ id: users.id }).from(users).where(eq(users.openId, loginId)))[0];
      if (existingWithOpenId) loginId = `SCH_${cleanCode}_${id}`;
      await db.insert(users).values({
        openId: loginId,
        name: `${school.name} Administrator`,
        email: userEmail,
        passwordHash,
        loginMethod: "local",
        role: "SCHOOL_ADMIN",
        schoolId: id,
        isActive: true,
      });
    }

    await audit(currentUser(res), "GENERATE_SCHOOL_CREDENTIALS", "school", id, id, { loginId });
    res.json({
      success: true,
      credentials: {
        loginId,
        email: userEmail ?? "",
        password: rawPassword,
      },
    });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/schools/:id", async (req, res) => {
  try {
    const id = requestedSchoolId(currentUser(res), req.params.id);
    if (!id) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const row = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!row) return res.status(404).json({ error: "School not found" });
    const enriched = (await attachSchoolTemplateMeta(db, [row]))[0];
    return res.json(enriched);
  } catch (e) {
    fail(res, e);
  }
});

const handleUpdateSchool = async (req: Request, res: Response) => {
  try {
    const user = currentUser(res);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const existing = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!existing) {
      return res.status(404).json({ error: "School not found. It may have been removed or deleted." });
    }

    const nextName = req.body.name && String(req.body.name).trim() ? String(req.body.name).trim() : existing.name;
    const nextCode = req.body.shortCode && String(req.body.shortCode).trim() ? String(req.body.shortCode).trim().toUpperCase() : existing.shortCode;
    const nextEmail = req.body.email && String(req.body.email).trim() ? String(req.body.email).trim() : null;
    const nextPhone = req.body.phone && String(req.body.phone).trim() ? String(req.body.phone).trim() : null;
    const nextAddress = req.body.address && String(req.body.address).trim() ? String(req.body.address).trim() : null;

    if (nextCode !== existing.shortCode) {
      const [conflict] = await db.select().from(schools).where(eq(schools.shortCode, nextCode)).limit(1);
      if (conflict && conflict.id !== id) {
        return res.status(409).json({ error: `School code "${nextCode}" is already in use by another school.` });
      }
    }

    await db.update(schools).set({
      name: nextName,
      shortCode: nextCode,
      email: nextEmail,
      phone: nextPhone,
      address: nextAddress,
      updatedAt: new Date(),
    }).where(eq(schools.id, id));

    // Keep school admin user email in sync if provided
    if (req.body.email !== undefined) {
      await db.update(users).set({ email: nextEmail }).where(and(eq(users.schoolId, id), eq(users.role, "SCHOOL_ADMIN")));
    }

    await audit(user, "UPDATE_SCHOOL", "school", id, id, req.body);
    const updated = (await attachSchoolTemplateMeta(db, [
      (await db.select().from(schools).where(eq(schools.id, id)))[0]
    ]))[0];
    res.json(updated);
  } catch (e) { fail(res, e); }
};

router.put("/schools/:id", requireRole(adminRoles), handleUpdateSchool);
router.patch("/schools/:id", requireRole(adminRoles), handleUpdateSchool);

const handleSchoolStatusUpdate = async (req: any, res: any) => {
  try {
    const user = currentUser(res);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const existing = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    if (!existing) return res.status(404).json({ error: "School not found" });

    const nextIsActive = Boolean(req.body.isActive);
    await db.update(schools).set({ isActive: nextIsActive, updatedAt: new Date() }).where(eq(schools.id, id));
    await audit(user, "UPDATE_SCHOOL_STATUS", "school", id, id, { isActive: nextIsActive });
    const updated = (await attachSchoolTemplateMeta(db, [
      (await db.select().from(schools).where(eq(schools.id, id)))[0]
    ]))[0];
    res.json({ success: true, school: updated });
  } catch (e) { fail(res, e); }
};

router.patch("/schools/:id/status", requireRole(adminRoles), handleSchoolStatusUpdate);
router.post("/schools/:id/status", requireRole(adminRoles), handleSchoolStatusUpdate);

router.delete("/schools/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const actor = currentUser(res);

    // Wrap entire cascade in a transaction to prevent partial deletes
    await db.transaction(async (tx) => {
      // Cleanly delete all dependent records and associated users so no orphaned users remain
      const schoolCards = await tx.select({ id: idCards.id }).from(idCards).where(eq(idCards.schoolId, id));
      const cardIdList = schoolCards.map((c) => c.id);
      if (cardIdList.length > 0) {
        await tx.delete(approvalHistory).where(inArray(approvalHistory.idCardId, cardIdList));
        await tx.delete(idCardFiles).where(inArray(idCardFiles.idCardId, cardIdList));
        await tx.delete(idCardData).where(inArray(idCardData.idCardId, cardIdList));
        await tx.delete(idCards).where(eq(idCards.schoolId, id));
      }
      await tx.delete(idCardRequests).where(eq(idCardRequests.schoolId, id));
      await tx.delete(schoolTemplates).where(eq(schoolTemplates.schoolId, id));
      await tx.delete(notifications).where(eq(notifications.schoolId, id));
      await tx.delete(auditLogs).where(eq(auditLogs.schoolId, id));

      // Delete all associated users for this school
      const schoolUsers = await tx.select({ id: users.id }).from(users).where(eq(users.schoolId, id));
      const schoolUserIds = schoolUsers.map((u) => u.id);
      if (schoolUserIds.length > 0) {
        await tx.delete(approvalHistory).where(inArray(approvalHistory.actedByUserId, schoolUserIds));
        await tx.delete(notifications).where(inArray(notifications.userId, schoolUserIds));
        await tx.delete(auditLogs).where(inArray(auditLogs.userId, schoolUserIds));
        await tx.delete(users).where(eq(users.schoolId, id));
      }

      // Finally delete the school
      await tx.delete(schools).where(eq(schools.id, id));
    });

    await audit(actor, "DELETE_SCHOOL", "school", id, null, null);
    res.status(200).json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/users", requireRole(adminRoles), async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const rows = await db
      .select()
      .from(users)
      .where(sql`${users.email} IS NULL OR (${users.email} NOT LIKE '%@test.local' AND ${users.email} NOT LIKE '%@example.test' AND ${users.openId} NOT LIKE 'seed_%')`)
      .orderBy(desc(users.createdAt));
    res.json(rows.map(safeUser));
  } catch (e) { fail(res, e); }
});

router.post("/users", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const schoolId = Number(req.body.schoolId);
    if (!schoolId) return res.status(400).json({ error: "schoolId is required" });
    if (String(req.body.password ?? "").length < 8) return res.status(400).json({ error: "A password of at least 8 characters is required" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Generate or validate openId uniqueness
    const openId = String(req.body.openId ?? `local_${Date.now()}`);
    const existingOpenId = (await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)))[0];
    if (existingOpenId) {
      return res.status(409).json({ error: `Login ID "${openId}" is already in use. Please choose a different one.` });
    }

    const result = await db.insert(users).values({
      openId,
      name: req.body.name ?? null,
      email: req.body.email ?? null,
      loginMethod: "local",
      passwordHash: req.body.password ? await hashPassword(String(req.body.password)) : null,
      role: req.body.role ?? "VIEWER",
      schoolId,
    });
    const id = Number(result[0].insertId);
    await audit(actor, "CREATE_USER", "user", id, schoolId, req.body);
    res.status(201).json(safeUser((await db.select().from(users).where(eq(users.id, id)))[0]));
  } catch (e) { fail(res, e); }
});

router.get("/users/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const target = (await db.select().from(users).where(eq(users.id, Number(req.params.id))))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    res.json(safeUser(target));
  } catch (e) { fail(res, e); }
});

router.put("/users/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    const nextSchoolId = req.body.schoolId !== undefined ? (req.body.schoolId ? Number(req.body.schoolId) : null) : target.schoolId;
    await db.update(users).set({ name: req.body.name, email: req.body.email, role: req.body.role, schoolId: nextSchoolId }).where(eq(users.id, id));
    await audit(actor, "UPDATE_USER", "user", id, target.schoolId, req.body);
    res.json(safeUser((await db.select().from(users).where(eq(users.id, id)))[0]));
  } catch (e) { fail(res, e); }
});

router.patch("/users/:id/status", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    await db.update(users).set({ isActive: Boolean(req.body.isActive) }).where(eq(users.id, id));
    await audit(actor, "UPDATE_USER_STATUS", "user", id, target.schoolId, req.body);
    res.json({ success: true });
  } catch (e) { fail(res, e); }
});

router.delete("/users/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const actor = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const target = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    await db.delete(users).where(eq(users.id, id));
    await audit(actor, "DELETE_USER", "user", id, target.schoolId);
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

router.get("/templates", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    const tmplList = adminRoles.has(user.role)
      ? await db.select().from(idCardTemplates).orderBy(desc(idCardTemplates.createdAt))
      : await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).orderBy(desc(idCardTemplates.createdAt));

    const allElements = (await db.select().from(templateElements)).map(normalizeTemplateElement);
    const elementsByTemplate = new Map<number, typeof allElements>();
    for (const el of allElements) {
      const list = elementsByTemplate.get(el.templateId) ?? [];
      list.push(el);
      elementsByTemplate.set(el.templateId, list);
    }

    const result = tmplList.map((tmpl) => ({
      ...tmpl,
      elements: elementsByTemplate.get(tmpl.id) ?? [],
    }));
    res.json(result);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/templates", requireRole(adminRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const r = await db.insert(idCardTemplates).values({
      name: String(req.body.name),
      meta: req.body.meta ?? null,
      description: req.body.description ?? null,
      status: req.body.status ?? "DRAFT",
      accent: req.body.accent ?? "teal",
      orientation: req.body.orientation ?? "landscape",
      cardWidth: req.body.cardWidth ? Number(req.body.cardWidth) : 324,
      cardHeight: req.body.cardHeight ? Number(req.body.cardHeight) : 204,
      createdByUserId: currentUser(res).id,
    });
    const id = Number(r[0].insertId);
    await audit(currentUser(res), "CREATE_TEMPLATE", "template", id, null, req.body);
    res.status(201).json((await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0]);
  } catch (e) {
    fail(res, e);
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!template) return res.status(404).json({ error: "Template not found" });
    const user = currentUser(res);
    if (!adminRoles.has(user.role) && template.status !== "ACTIVE") {
      return res.status(404).json({ error: "Template not found" });
    }
    const elements = (await db.select().from(templateElements).where(eq(templateElements.templateId, id))).map(normalizeTemplateElement);
    res.json({ ...template, elements });
  } catch (e) {
    fail(res, e);
  }
});

const updateTemplateStatusHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Validate status is a valid enum value
    const validStatuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"];
    if (!req.body.status || !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!template) return res.status(404).json({ error: "Template not found" });

    await db.update(idCardTemplates).set({ status: req.body.status }).where(eq(idCardTemplates.id, id));
    await audit(currentUser(res), "UPDATE_TEMPLATE_STATUS", "template", id, null, req.body);
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
};
router.patch("/templates/:id/status", requireRole(adminRoles), updateTemplateStatusHandler);
router.post("/templates/:id/status", requireRole(adminRoles), updateTemplateStatusHandler);

router.put("/templates/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid template ID" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const existingTemplate = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!existingTemplate) return res.status(404).json({ error: "Template not found" });

    const updateSet: Record<string, unknown> = {};
    if (req.body.name !== undefined) updateSet.name = req.body.name;
    if (req.body.meta !== undefined) updateSet.meta = req.body.meta;
    if (req.body.description !== undefined) updateSet.description = req.body.description;
    if (req.body.accent !== undefined) updateSet.accent = req.body.accent;
    if (req.body.status !== undefined) updateSet.status = req.body.status;
    if (req.body.orientation !== undefined) updateSet.orientation = req.body.orientation;
    if (req.body.cardWidth !== undefined) updateSet.cardWidth = Number(req.body.cardWidth);
    if (req.body.cardHeight !== undefined) updateSet.cardHeight = Number(req.body.cardHeight);
    if (Object.keys(updateSet).length) await db.update(idCardTemplates).set(updateSet).where(eq(idCardTemplates.id, id));

    if (Array.isArray(req.body.elements)) {
      // Reconcile existing elements to preserve IDs
      const existingElements = await db.select().from(templateElements).where(eq(templateElements.templateId, id));
      const existingByKey = new Map(existingElements.map((el) => [el.elementKey, el]));
      const incomingKeys = new Set<string>();

      for (let i = 0; i < req.body.elements.length; i++) {
        const element = req.body.elements[i];
        incomingKeys.add(element.elementKey);
        const existing = existingByKey.get(element.elementKey);
        if (existing) {
          await db
            .update(templateElements)
            .set({
              elementType: element.elementType,
              label: element.label ?? null,
              config: parseJsonColumn(element.config) as never,
              sortOrder: element.sortOrder ?? i,
            })
            .where(eq(templateElements.id, existing.id));
        } else {
          await db.insert(templateElements).values({
            templateId: id,
            elementKey: element.elementKey,
            elementType: element.elementType,
            label: element.label ?? null,
            config: parseJsonColumn(element.config) as never,
            sortOrder: element.sortOrder ?? i,
          });
        }
      }

      // Delete removed elements
      for (const existing of existingElements) {
        if (!incomingKeys.has(existing.elementKey)) {
          await db.delete(templateElements).where(eq(templateElements.id, existing.id));
        }
      }
    }

    await audit(currentUser(res), "UPDATE_TEMPLATE", "template", id, null, req.body);
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/templates/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid template ID" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, id)))[0];
    if (!template) return res.status(404).json({ error: "Template not found" });

    // Check if any ID cards are using this template
    const usedByCards = await db.select({ id: idCards.id }).from(idCards).where(eq(idCards.templateId, id)).limit(1);
    if (usedByCards.length > 0) {
      return res.status(400).json({
        error: "Cannot delete template: it is currently used by ID cards. Please set its status to INACTIVE or ARCHIVED instead.",
      });
    }

    // Check if any ID card requests reference this template
    const usedByRequests = await db.select({ id: idCardRequests.id }).from(idCardRequests).where(eq(idCardRequests.templateId, id)).limit(1);
    if (usedByRequests.length > 0) {
      return res.status(400).json({
        error: "Cannot delete template: it is currently referenced by approval requests. Please set its status to INACTIVE or ARCHIVED instead.",
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(templateElements).where(eq(templateElements.templateId, id));
      await tx.delete(schoolTemplates).where(eq(schoolTemplates.templateId, id));
      await tx.delete(idCardTemplates).where(eq(idCardTemplates.id, id));
      await tx.insert(auditLogs).values({
        userId: currentUser(res).id > 0 ? currentUser(res).id : null,
        schoolId: null,
        action: "DELETE_TEMPLATE",
        entityType: "template",
        entityId: id,
      });
    });

    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

router.post("/upload", async (req, res) => {
  try {
    const user = currentUser(res);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!schoolWriteRoles.has(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions: upload is restricted to administrators and operators" });
    }

    // Preserve school / tenant isolation
    const targetSchoolId = req.body?.schoolId ? Number(req.body.schoolId) : user.schoolId;
    if (!adminRoles.has(user.role)) {
      if (!user.schoolId || (req.body?.schoolId && targetSchoolId !== user.schoolId)) {
        return res.status(403).json({ error: "School access denied" });
      }
    }

    const { filename, contentType, dataBase64 } = req.body || {};
    if (!dataBase64 || typeof dataBase64 !== "string") {
      return res.status(400).json({ error: "dataBase64 is required" });
    }

    const cleanBase64 = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
    if (!cleanBase64.trim()) {
      return res.status(400).json({ error: "File content is empty" });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 payload" });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: "File content is empty" });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ error: "File exceeds 5MB size limit" });
    }

    // Safe MIME type detection via magic numbers - do not rely solely on client MIME
    const detectedMime = detectImageMimeType(buffer);
    if (!detectedMime) {
      return res.status(400).json({
        error: "Invalid file type. Only PNG, JPEG, WEBP, and GIF images are allowed",
      });
    }

    // If client supplied a contentType, ensure it is an image and doesn't conflict maliciously
    if (contentType && typeof contentType === "string") {
      const clientMime = contentType.toLowerCase().trim();
      if (!clientMime.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid file type. Only image uploads are allowed" });
      }
    }

    // Sanitize filename and prevent directory traversal
    const extMap: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    const safeExt = extMap[detectedMime] || ".png";
    const rawName = typeof filename === "string" ? filename.replace(/[^a-zA-Z0-9._-]/g, "_") : `upload_${Date.now()}`;
    const baseName = path.basename(rawName).replace(/^\.+/, "") || `upload_${Date.now()}`;
    const finalName = baseName.toLowerCase().endsWith(safeExt) ? baseName : `${baseName}${safeExt}`;

    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const { storagePut } = await import("./storage");
        const folder = targetSchoolId ? `schools/${targetSchoolId}` : "templates";
        const stored = await storagePut(`${folder}/${finalName}`, buffer, detectedMime);
        return res.json({ url: stored.url });
      } catch (err) {
        console.warn("[Upload] Storage failed, falling back to data URL", err);
      }
    }
    const dataUrl = `data:${detectedMime};base64,${cleanBase64}`;
    return res.json({ url: dataUrl });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/schools/:schoolId/templates", async (req, res) => {
  try {
    const user = currentUser(res);
    const schoolId = requestedSchoolId(user, req.params.schoolId);
    if (!schoolId || !canReadSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    res.json(await db.select().from(schoolTemplates).where(eq(schoolTemplates.schoolId, schoolId)));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/schools/:schoolId/templates/select", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const schoolId = requestedSchoolId(user, req.params.schoolId);
    if (!schoolId || !canManageSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const templateId = Number(req.body.templateId);
    const targetTemplate = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, templateId)))[0];
    if (!targetTemplate) return res.status(404).json({ error: "Template not found" });
    if (targetTemplate.status !== "ACTIVE" && !adminRoles.has(user.role)) {
      return res.status(400).json({ error: "Only ACTIVE templates can be selected" });
    }
    const existing = (
      await db
        .select()
        .from(schoolTemplates)
        .where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.templateId, templateId)))
    )[0];
    if (existing?.isLocked) return res.status(409).json({ error: "Template selection is locked" });

    // Atomically reset previous default templates for this school
    await db.update(schoolTemplates).set({ isDefault: false }).where(eq(schoolTemplates.schoolId, schoolId));

    if (existing) await db.update(schoolTemplates).set({ isDefault: true, assignedByUserId: user.id }).where(eq(schoolTemplates.id, existing.id));
    else await db.insert(schoolTemplates).values({ schoolId, templateId, isDefault: true, assignedByUserId: user.id });
    await audit(user, "SELECT_TEMPLATE", "school_template", existing?.id ?? null, schoolId, { templateId });
    res.json({ success: true, selectedTemplateId: templateId, selectedTemplateName: targetTemplate.name });
  } catch (e) {
    fail(res, e);
  }
});

for (const action of ["lock", "unlock"] as const)
  router.post(`/schools/:schoolId/templates/${action}`, requireRole(schoolManagerRoles), async (req, res) => {
    try {
      const user = currentUser(res);
      const schoolId = requestedSchoolId(user, req.params.schoolId);
      if (!schoolId || !canManageSchool(user, schoolId)) return res.status(403).json({ error: "School access denied" });
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database not available" });
      const templateId = Number(req.body.templateId);
      await db
        .update(schoolTemplates)
        .set(
          action === "lock"
            ? { isLocked: true, lockedAt: new Date(), lockedByUserId: user.id }
            : { isLocked: false, lockedAt: null, lockedByUserId: null },
        )
        .where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.templateId, templateId)));
      await audit(user, action === "lock" ? "LOCK_TEMPLATE" : "UNLOCK_TEMPLATE", "school_template", null, schoolId, { templateId });
      res.json({ success: true });
    } catch (e) {
      fail(res, e);
    }
  });

// ─── ID CARD NUMBER GENERATOR ─────────────────────────────────────────────
async function generateCardNumber(schoolId: number): Promise<string> {
  const db = await getDb();
  const year = new Date().getFullYear();
  const prefix = `IDC-${year}-`;
  const existingCards = db
    ? await db.select({ cardNumber: idCards.cardNumber }).from(idCards).where(eq(idCards.schoolId, schoolId))
    : [];
  let seq = existingCards.length + 1;
  let candidate = `${prefix}${String(seq).padStart(6, "0")}`;
  const existingSet = new Set(existingCards.map((c) => c.cardNumber));
  while (existingSet.has(candidate)) {
    seq++;
    candidate = `${prefix}${String(seq).padStart(6, "0")}`;
  }
  return candidate;
}

// ─── ID CARDS CRUD ────────────────────────────────────────────────────────
router.get("/id-cards", async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    let query = db
      .select({
        id: idCards.id,
        schoolId: idCards.schoolId,
        templateId: idCards.templateId,
        requestId: idCards.requestId,
        cardNumber: idCards.cardNumber,
        status: idCards.status,
        submittedByUserId: idCards.submittedByUserId,
        approvedByUserId: idCards.approvedByUserId,
        printedAt: idCards.printedAt,
        createdAt: idCards.createdAt,
        updatedAt: idCards.updatedAt,
        schoolName: schools.name,
        templateName: idCardTemplates.name,
      })
      .from(idCards)
      .leftJoin(schools, eq(idCards.schoolId, schools.id))
      .leftJoin(idCardTemplates, eq(idCards.templateId, idCardTemplates.id));

    let cardsList: any[];
    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        cardsList = await query.where(eq(idCards.schoolId, Number(req.query.schoolId))).orderBy(desc(idCards.createdAt));
      } else {
        cardsList = await query.orderBy(desc(idCards.createdAt));
      }
    } else {
      if (!user.schoolId) return res.json([]);
      cardsList = await query.where(eq(idCards.schoolId, user.schoolId)).orderBy(desc(idCards.createdAt));
    }

    // Attach studentName from id_card_data if available
    const cardIds = cardsList.map((c) => c.id);
    let allData: Array<{ idCardId: number; fieldKey: string; fieldValue: string | null }> = [];
    if (cardIds.length > 0) {
      allData = await db
        .select({
          idCardId: idCardData.idCardId,
          fieldKey: idCardData.fieldKey,
          fieldValue: idCardData.fieldValue,
        })
        .from(idCardData)
        .where(inArray(idCardData.idCardId, cardIds));
    }

    const dataByCardId = new Map<number, Record<string, string>>();
    for (const d of allData) {
      const map = dataByCardId.get(d.idCardId) ?? {};
      const val = d.fieldValue || "";
      // Separate metadata from full base64 images in list responses
      const isHeavy =
        d.fieldKey === "photo" ||
        d.fieldKey === "student_photo" ||
        d.fieldKey === "signature" ||
        d.fieldKey === "logo" ||
        val.startsWith("data:image/") ||
        val.length > 500;

      map[d.fieldKey] = isHeavy ? "[IMAGE_ATTACHED]" : val;
      dataByCardId.set(d.idCardId, map);
    }

    let results = cardsList.map((c) => {
      const dataMap = dataByCardId.get(c.id) ?? {};
      const studentName = dataMap["student_name"] || dataMap["studentName"] || "Student";
      return {
        ...c,
        studentName,
        dataMap,
      };
    });

    if (req.query.status) {
      results = results.filter((c) => c.status === req.query.status);
    }

    if (req.query.q) {
      const q = String(req.query.q).toLowerCase();
      results = results.filter(
        (c) =>
          c.cardNumber.toLowerCase().includes(q) ||
          c.studentName.toLowerCase().includes(q) ||
          (c.schoolName && c.schoolName.toLowerCase().includes(q)),
      );
    }

    res.json(results);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Anti-spoofing: Non-super-admins strictly use user.schoolId
    const schoolId = adminRoles.has(user.role)
      ? Number(req.body.schoolId || user.schoolId)
      : user.schoolId;

    if (!schoolId) return res.status(400).json({ error: "schoolId is required" });

    // Validate school exists
    const school = (await db.select().from(schools).where(eq(schools.id, schoolId)))[0];
    if (!school) return res.status(404).json({ error: `School with ID ${schoolId} not found` });

    // Identify template: explicit or school locked / default
    let templateId = Number(req.body.templateId);
    if (!templateId) {
      const schoolTmpl =
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isLocked, true))))[0] ||
        (await db.select().from(schoolTemplates).where(and(eq(schoolTemplates.schoolId, schoolId), eq(schoolTemplates.isDefault, true))))[0];
      templateId = schoolTmpl?.templateId ?? (await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).limit(1))[0]?.id;
    }

    if (!templateId) {
      return res.status(400).json({ error: "No active template available for this school" });
    }

    // Generate or use persistent card number
    const cardNumber = req.body.cardNumber && String(req.body.cardNumber).trim()
      ? String(req.body.cardNumber).trim()
      : await generateCardNumber(schoolId);

    // Validate card number uniqueness for this school
    const existingCard = (
      await db
        .select({ id: idCards.id })
        .from(idCards)
        .where(and(eq(idCards.schoolId, schoolId), eq(idCards.cardNumber, cardNumber)))
    )[0];
    if (existingCard) {
      return res.status(400).json({ error: `Card number '${cardNumber}' already exists in this school` });
    }

    const r = await db.insert(idCards).values({
      schoolId,
      templateId,
      cardNumber,
      status: "DRAFT",
      submittedByUserId: user.id,
    });
    const id = Number(r[0].insertId);

    // Save dynamic fields to id_card_data
    if (req.body.data && typeof req.body.data === "object") {
      for (const [fieldKey, fieldValue] of Object.entries(req.body.data)) {
        if (fieldValue !== undefined && fieldValue !== null) {
          await db.insert(idCardData).values({
            idCardId: id,
            fieldKey,
            fieldValue: String(fieldValue),
          });
        }
      }
    }

    // Save photo file metadata if provided
    const photoUrl = req.body.data?.photo || req.body.photoUrl;
    if (photoUrl) {
      await db.insert(idCardFiles).values({
        idCardId: id,
        fileType: "PHOTO",
        fileName: req.body.photoFileName || "student_photo.png",
        fileUrl: photoUrl,
        mimeType: "image/png",
        fileSize: null,
        uploadedByUserId: user.id,
      });
    }

    // Save signature file metadata if provided
    const signatureUrl = req.body.data?.signature || req.body.signatureUrl;
    if (signatureUrl) {
      await db.insert(idCardFiles).values({
        idCardId: id,
        fileType: "SIGNATURE",
        fileName: req.body.signatureFileName || "signature.png",
        fileUrl: signatureUrl,
        mimeType: "image/png",
        fileSize: null,
        uploadedByUserId: user.id,
      });
    }

    await audit(user, "CREATE_ID_CARD", "id_card", id, schoolId, { cardNumber, templateId });
    const created = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    res.status(201).json(created);
  } catch (e) {
    fail(res, e);
  }
});

router.get("/id-cards/:id", async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });
    if (!canReadSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    const dataRows = await db.select().from(idCardData).where(eq(idCardData.idCardId, id));
    const dataMap: Record<string, string> = {};
    for (const d of dataRows) {
      dataMap[d.fieldKey] = d.fieldValue || "";
    }

    const files = await db.select().from(idCardFiles).where(eq(idCardFiles.idCardId, id));
    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, card.templateId)))[0];
    const elements = template
      ? (await db.select().from(templateElements).where(eq(templateElements.templateId, template.id))).map(normalizeTemplateElement)
      : [];

    const history = await db
      .select({
        id: approvalHistory.id,
        idCardId: approvalHistory.idCardId,
        fromStatus: approvalHistory.fromStatus,
        toStatus: approvalHistory.toStatus,
        action: approvalHistory.action,
        comments: approvalHistory.comments,
        actedByUserId: approvalHistory.actedByUserId,
        createdAt: approvalHistory.createdAt,
        actorName: users.name,
        actorRole: users.role,
      })
      .from(approvalHistory)
      .leftJoin(users, eq(approvalHistory.actedByUserId, users.id))
      .where(eq(approvalHistory.idCardId, id))
      .orderBy(desc(approvalHistory.createdAt));

    const request = card.requestId
      ? (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0]
      : null;

    res.json({
      ...card,
      data: dataRows,
      dataMap,
      files,
      template: template ? { ...template, elements } : null,
      approvalHistory: history,
      request,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.put("/id-cards/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });

    // Persist card number — do NOT change on edit
    const updatePayload: Record<string, unknown> = {};
    if (req.body.templateId !== undefined) updatePayload.templateId = Number(req.body.templateId);

    if (Object.keys(updatePayload).length > 0) {
      await db.update(idCards).set(updatePayload).where(eq(idCards.id, id));
    }

    // Update dynamic fields: merge/upsert fields
    if (req.body.data && typeof req.body.data === "object") {
      for (const [fieldKey, fieldValue] of Object.entries(req.body.data)) {
        if (fieldValue !== undefined && fieldValue !== null) {
          const existingField = (await db.select().from(idCardData).where(and(eq(idCardData.idCardId, id), eq(idCardData.fieldKey, fieldKey))))[0];
          if (existingField) {
            await db.update(idCardData).set({ fieldValue: String(fieldValue) }).where(eq(idCardData.id, existingField.id));
          } else {
            await db.insert(idCardData).values({
              idCardId: id,
              fieldKey,
              fieldValue: String(fieldValue),
            });
          }
        }
      }
    }

    // Update photo/signature files if provided
    if (req.body.data?.photo || req.body.photoUrl) {
      const pUrl = req.body.data?.photo || req.body.photoUrl;
      const existingPhoto = (await db.select().from(idCardFiles).where(and(eq(idCardFiles.idCardId, id), eq(idCardFiles.fileType, "PHOTO"))))[0];
      if (existingPhoto) {
        await db.update(idCardFiles).set({ fileUrl: pUrl }).where(eq(idCardFiles.id, existingPhoto.id));
      } else {
        await db.insert(idCardFiles).values({
          idCardId: id,
          fileType: "PHOTO",
          fileName: "student_photo.png",
          fileUrl: pUrl,
          mimeType: "image/png",
          uploadedByUserId: user.id,
        });
      }
    }

    await audit(user, "UPDATE_ID_CARD", "id_card", id, card.schoolId, req.body);
    res.json({ success: true, id });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/id-cards/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });

    await db.delete(idCards).where(eq(idCards.id, id));
    await audit(user, "DELETE_ID_CARD", "id_card", id, card.schoolId);
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

// ─── SUBMISSION & TRANSITIONS ──────────────────────────────────────────────
router.post("/id-cards/:id/submit", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardId = Number(req.params.id);
    if (!cardId || isNaN(cardId)) return res.status(400).json({ error: "Invalid card ID" });
    const card = (await db.select().from(idCards).where(eq(idCards.id, cardId)))[0];
    if (!card) return res.status(404).json({ error: "ID card not found" });

    // Allowed transition check (Admin submits or resubmits)
    if (card.status !== "DRAFT" && card.status !== "CHANGES_REQUIRED" && card.status !== "REJECTED") {
      return res.status(400).json({ error: `Cannot submit card in ${card.status} status. Invalid transition.` });
    }

    // Validate template exists and dynamic requirements
    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, card.templateId)))[0];
    if (!template) return res.status(400).json({ error: "Template no longer exists" });

    const elements = (await db.select().from(templateElements).where(eq(templateElements.templateId, template.id))).map(normalizeTemplateElement);
    const dataRows = await db.select().from(idCardData).where(eq(idCardData.idCardId, cardId));
    const dataMap: Record<string, string> = {};
    for (const d of dataRows) dataMap[d.fieldKey] = d.fieldValue || "";

    // Validate required dynamic fields
    for (const el of elements) {
      if (el.elementType === "DYNAMIC_FIELD") {
        const cfg = el.config as Record<string, any> | null;
        const fKey = cfg?.dynamicField;
        if (fKey && (!dataMap[fKey] || !dataMap[fKey].trim())) {
          return res.status(400).json({ error: `Missing required template field: ${fKey}` });
        }
      }
    }

    // Validate photo requirement
    const hasPhotoElement = elements.some((el) => el.elementType === "PHOTO");
    if (hasPhotoElement) {
      const cardFiles = await db
        .select()
        .from(idCardFiles)
        .where(and(eq(idCardFiles.idCardId, cardId), eq(idCardFiles.fileType, "PHOTO")));
      const hasPhoto =
        (dataMap["photo"] && dataMap["photo"].trim()) ||
        (dataMap["student_photo"] && dataMap["student_photo"].trim()) ||
        cardFiles.length > 0;
      if (!hasPhoto) {
        return res.status(400).json({ error: "Student photo is required by the template before submission" });
      }
    }

    const targetStatus = card.status === "CHANGES_REQUIRED" ? "RESUBMITTED" : "SUBMITTED";
    const action = card.status === "CHANGES_REQUIRED" ? "RESUBMIT_ID_CARD" : "SUBMIT_ID_CARD";

    const studentName = dataMap["student_name"] || dataMap["studentName"] || req.body.studentName || "Student";
    const admissionCode = dataMap["admission_number"] || card.cardNumber;

    let requestId = card.requestId;

    await db.transaction(async (tx) => {
      if (requestId) {
        await tx
          .update(idCardRequests)
          .set({
            studentName,
            status: targetStatus,
            submittedAt: new Date(),
            requestedByUserId: user.id,
          })
          .where(eq(idCardRequests.id, requestId));
      } else {
        // Check if a request already exists for this school and admissionCode
        const existingReq = (
          await tx
            .select()
            .from(idCardRequests)
            .where(
              and(
                eq(idCardRequests.schoolId, card.schoolId),
                eq(idCardRequests.admissionCode, admissionCode)
              )
            )
        )[0];

        if (existingReq) {
          // Check if another active card is currently linked to this request
          const otherCard = (
            await tx
              .select()
              .from(idCards)
              .where(
                and(
                  eq(idCards.requestId, existingReq.id),
                  ne(idCards.id, cardId),
                  inArray(idCards.status, ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PRINTED"])
                )
              )
          )[0];

          if (otherCard) {
            throw new Error(
              `An active ID card #${otherCard.cardNumber} with admission code '${admissionCode}' already exists (${otherCard.status})`
            );
          }

          // Re-use and update the existing request with the current card's details
          requestId = existingReq.id;
          await tx
            .update(idCardRequests)
            .set({
              studentName,
              status: targetStatus,
              submittedAt: new Date(),
              requestedByUserId: user.id,
              templateId: card.templateId,
            })
            .where(eq(idCardRequests.id, requestId));
          await tx.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
        } else {
          try {
            const result = await tx.insert(idCardRequests).values({
              studentName,
              admissionCode,
              schoolId: card.schoolId,
              status: targetStatus,
              requestedByUserId: user.id,
              templateId: card.templateId,
              submittedAt: new Date(),
            });
            requestId = Number(result[0].insertId);
            await tx.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
          } catch (err: any) {
            if (err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate entry") || err?.errno === 1062) {
              const conReq = (
                await tx
                  .select()
                  .from(idCardRequests)
                  .where(
                    and(
                      eq(idCardRequests.schoolId, card.schoolId),
                      eq(idCardRequests.admissionCode, admissionCode)
                    )
                  )
              )[0];
              if (conReq) {
                requestId = conReq.id;
                await tx
                  .update(idCardRequests)
                  .set({
                    studentName,
                    status: targetStatus,
                    submittedAt: new Date(),
                    requestedByUserId: user.id,
                    templateId: card.templateId,
                  })
                  .where(eq(idCardRequests.id, requestId));
                await tx.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
              } else {
                throw new Error(`A submission request for admission code '${admissionCode}' already exists for this school.`);
              }
            } else {
              throw err;
            }
          }
        }
      }

      await tx.update(idCards).set({ status: targetStatus, submittedByUserId: user.id, requestId }).where(eq(idCards.id, cardId));

      await tx.insert(approvalHistory).values({
        idCardId: cardId,
        fromStatus: card.status,
        toStatus: targetStatus,
        action,
        actedByUserId: user.id,
      });

      await tx.insert(auditLogs).values({
        userId: user.id > 0 ? user.id : null,
        schoolId: card.schoolId,
        action,
        entityType: "id_card",
        entityId: cardId,
        newValues: { requestId, status: targetStatus } as never,
      });
    });

    // Notify school users of submission by Admin
    const schoolUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, card.schoolId));
    for (const s of schoolUsers) {
      await notify(
        s.id,
        card.schoolId,
        action,
        `New ID Card for Approval: ${card.cardNumber}`,
        `${studentName}'s ID card was submitted by Admin for your review & approval`,
        "id_card",
        cardId,
      );
    }

    res.json({ success: true, requestId, status: targetStatus });
  } catch (e) {
    fail(res, e);
  }
});

// ─── APPROVAL & REVIEW TRANSITIONS (SCHOOL APPROVES / REJECTS, ADMIN PRINTS) ──
async function transitionApproval(
  req: Request,
  res: Response,
  targetStatus: "UNDER_REVIEW" | "CHANGES_REQUIRED" | "RESUBMITTED" | "APPROVED" | "REJECTED",
  action: string,
  comment?: string,
) {
  const user = currentUser(res);
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Database not available" });
  const paramId = Number(req.params.id);
  if (!paramId || isNaN(paramId)) return res.status(400).json({ error: "Invalid ID" });

  let request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, paramId)))[0];
  let card = (await db.select().from(idCards).where(eq(idCards.id, paramId)))[0];

  if (request && !card) {
    card = (await db.select().from(idCards).where(eq(idCards.requestId, request.id)))[0];
  } else if (card && !request && card.requestId) {
    request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0];
  }

  const schoolId = card?.schoolId ?? request?.schoolId;
  if (!schoolId) return res.status(404).json({ error: "Record not found" });

  const isCardSchool = user.schoolId !== null && user.schoolId === schoolId;
  const isSuperAdmin = adminRoles.has(user.role);

  // Cross-school data isolation check
  if (!isSuperAdmin && !isCardSchool) {
    return res.status(403).json({ error: "Access denied to ID card of another school" });
  }

  if (targetStatus === "RESUBMITTED" && !isSuperAdmin) {
    return res.status(403).json({ error: "Only administrators can resubmit cards" });
  }

  if (targetStatus === "CHANGES_REQUIRED" && !comment?.trim()) {
    return res.status(400).json({ error: "A comment is required when requesting changes" });
  }
  if (targetStatus === "REJECTED" && !comment?.trim()) {
    return res.status(400).json({ error: "A rejection reason is required when rejecting a card" });
  }

  const currentStatus = card?.status ?? request?.status ?? "DRAFT";

  // Strict transition validation
  if (targetStatus === "UNDER_REVIEW") {
    if (currentStatus !== "SUBMITTED" && currentStatus !== "RESUBMITTED") {
      return res.status(400).json({ error: `Cannot review card in ${currentStatus} status. Must be SUBMITTED or RESUBMITTED.` });
    }
  } else if (targetStatus === "APPROVED" || targetStatus === "CHANGES_REQUIRED" || targetStatus === "REJECTED") {
    if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED" && currentStatus !== "RESUBMITTED") {
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${targetStatus}` });
    }
  } else if (targetStatus === "RESUBMITTED") {
    if (currentStatus !== "CHANGES_REQUIRED" && currentStatus !== "REJECTED") {
      return res.status(400).json({ error: `Cannot resubmit card in ${currentStatus} status. Must be CHANGES_REQUIRED or REJECTED.` });
    }
  }

  await db.transaction(async (tx) => {
    if (request) {
      await tx
        .update(idCardRequests)
        .set({
          status: targetStatus,
          reviewNote: comment ?? (targetStatus === "APPROVED" ? null : request.reviewNote),
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          submittedAt: targetStatus === "RESUBMITTED" ? new Date() : request.submittedAt,
        })
        .where(eq(idCardRequests.id, request.id));
    }

    if (card) {
      await tx
        .update(idCards)
        .set({
          status: targetStatus,
          approvedByUserId: targetStatus === "APPROVED" ? user.id : card.approvedByUserId,
        })
        .where(eq(idCards.id, card.id));

      await tx.insert(approvalHistory).values({
        idCardId: card.id,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        action,
        comments: comment ?? null,
        actedByUserId: user.id,
      });

      await tx.insert(auditLogs).values({
        userId: user.id > 0 ? user.id : null,
        schoolId: card.schoolId,
        action,
        entityType: "id_card",
        entityId: card.id,
        newValues: {
          requestId: request?.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          comment,
        } as never,
      });
    } else if (request) {
      await tx.insert(auditLogs).values({
        userId: user.id > 0 ? user.id : null,
        schoolId: request.schoolId,
        action,
        entityType: "id_card_request",
        entityId: request.id,
        newValues: {
          fromStatus: currentStatus,
          toStatus: targetStatus,
          comment,
        } as never,
      });
    }
  });

  // Send notifications
  if (targetStatus === "APPROVED" || targetStatus === "REJECTED") {
    const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
    for (const a of adminUsers) {
      await notify(
        a.id,
        schoolId,
        action,
        `ID card ${targetStatus === "APPROVED" ? "approved" : "rejected"} by school: #${card?.cardNumber ?? request?.admissionCode}`,
        comment ?? `School marked ID card #${card?.cardNumber ?? request?.admissionCode} as ${targetStatus}`,
        "id_card",
        card?.id ?? request?.id,
      );
    }
  } else if (targetStatus === "RESUBMITTED") {
    const schoolUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, schoolId));
    for (const s of schoolUsers) {
      await notify(
        s.id,
        schoolId,
        action,
        `ID card resubmitted: #${card?.cardNumber ?? request?.admissionCode}`,
        `Admin resubmitted card for review`,
        "id_card",
        card?.id ?? request?.id,
      );
    }
  }

  res.json({ success: true, status: targetStatus });
}

// Approval endpoints (both /api/approvals and /api/id-cards)
// RBAC: review/approve/reject/request-changes require at least school manager role
router.post("/approvals/:id/review", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "UNDER_REVIEW", "START_REVIEW");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/request-changes", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "CHANGES_REQUIRED", "REQUEST_CHANGES", req.body.comment || req.body.note);
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/resubmit", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "RESUBMITTED", "RESUBMIT_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/approve", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "APPROVED", "APPROVE_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/reject", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/:id/review", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "UNDER_REVIEW", "START_REVIEW");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/request-changes", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "CHANGES_REQUIRED", "REQUEST_CHANGES", req.body.comment || req.body.note);
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/resubmit", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "RESUBMITTED", "RESUBMIT_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/approve", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "APPROVED", "APPROVE_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/reject", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment);
  } catch (e) {
    fail(res, e);
  }
});

// Bulk Approve and Reject Endpoints (available to both Super Admin and School Managers for their schools)
async function handleBulkApprovalTransition(
  req: Request,
  res: Response,
  targetStatus: "APPROVED" | "REJECTED",
  action: string,
  comment?: string
) {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    const cardIds: number[] = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];
    if (cardIds.length === 0) return res.status(400).json({ error: "cardIds array is required" });

    const isSuperAdmin = adminRoles.has(user.role);
    let successCount = 0;
    const errors: string[] = [];

    for (const cardId of cardIds) {
      if (!cardId || isNaN(cardId)) continue;
      let request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, cardId)))[0];
      let card = (await db.select().from(idCards).where(eq(idCards.id, cardId)))[0];

      if (request && !card) {
        card = (await db.select().from(idCards).where(eq(idCards.requestId, request.id)))[0];
      } else if (card && !request && card.requestId) {
        request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0];
      }

      const schoolId = card?.schoolId ?? request?.schoolId;
      if (!schoolId) {
        errors.push(`Card #${cardId} not found`);
        continue;
      }

      const isCardSchool = user.schoolId !== null && user.schoolId === schoolId;
      if (!isSuperAdmin && !isCardSchool) {
        errors.push(`Access denied for card #${cardId}`);
        continue;
      }

      const currentStatus = card?.status ?? request?.status ?? "DRAFT";
      // Allow approving/rejecting cards that are pending review/action
      if (
        currentStatus !== "UNDER_REVIEW" &&
        currentStatus !== "SUBMITTED" &&
        currentStatus !== "RESUBMITTED"
      ) {
        // If already in target status, count as handled
        if (currentStatus === targetStatus) {
          successCount++;
          continue;
        }
        errors.push(`Card #${card?.cardNumber ?? cardId} cannot be ${targetStatus.toLowerCase()}d from ${currentStatus}`);
        continue;
      }

      await db.transaction(async (tx) => {
        if (request) {
          await tx
            .update(idCardRequests)
            .set({
              status: targetStatus,
              reviewNote: comment ?? (targetStatus === "APPROVED" ? null : request.reviewNote),
              reviewedByUserId: user.id,
              reviewedAt: new Date(),
            })
            .where(eq(idCardRequests.id, request.id));
        }

        if (card) {
          await tx
            .update(idCards)
            .set({
              status: targetStatus,
              approvedByUserId: targetStatus === "APPROVED" ? user.id : card.approvedByUserId,
            })
            .where(eq(idCards.id, card.id));

          await tx.insert(approvalHistory).values({
            idCardId: card.id,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            action,
            comments: comment ?? (targetStatus === "APPROVED" ? "Bulk approved" : "Bulk rejected"),
            actedByUserId: user.id,
          });

          await tx.insert(auditLogs).values({
            userId: user.id > 0 ? user.id : null,
            schoolId: card.schoolId,
            action,
            entityType: "id_card",
            entityId: card.id,
            newValues: {
              requestId: request?.id,
              fromStatus: currentStatus,
              toStatus: targetStatus,
              comment,
              isBulk: true,
            } as never,
          });
        }
      });

      // Notification
      const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
      for (const a of adminUsers) {
        if (a.id !== user.id) {
          await notify(
            a.id,
            schoolId,
            action,
            `ID card ${targetStatus === "APPROVED" ? "approved" : "rejected"}: #${card?.cardNumber ?? request?.admissionCode}`,
            comment ?? `ID card #${card?.cardNumber ?? request?.admissionCode} was ${targetStatus.toLowerCase()}d`,
            "id_card",
            card?.id ?? request?.id,
          );
        }
      }

      successCount++;
    }

    res.json({
      success: true,
      processed: successCount,
      totalRequested: cardIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    fail(res, e);
  }
}

router.post("/approvals/bulk-approve", requireRole(schoolManagerRoles), async (req, res) => {
  await handleBulkApprovalTransition(req, res, "APPROVED", "APPROVE_ID_CARD", req.body.comment);
});
router.post("/approvals/bulk-reject", requireRole(schoolManagerRoles), async (req, res) => {
  await handleBulkApprovalTransition(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment || "Rejected via bulk action");
});
router.post("/id-cards/bulk-approve", requireRole(schoolManagerRoles), async (req, res) => {
  await handleBulkApprovalTransition(req, res, "APPROVED", "APPROVE_ID_CARD", req.body.comment);
});
router.post("/id-cards/bulk-reject", requireRole(schoolManagerRoles), async (req, res) => {
  await handleBulkApprovalTransition(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment || "Rejected via bulk action");
});

// ─── PRINTING ─────────────────────────────────────────────────────────────
router.post("/id-cards/:id/print", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card || !canReadSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    // Strict rule: Only APPROVED cards may normally be printed
    if (card.status !== "APPROVED" && card.status !== "PRINTED") {
      return res.status(400).json({ error: `Only APPROVED cards may be printed. Current status: ${card.status}` });
    }

    if (card.status === "APPROVED") {
      await db.update(idCards).set({ status: "PRINTED", printedAt: new Date() }).where(eq(idCards.id, id));
      await db.insert(approvalHistory).values({
        idCardId: id,
        fromStatus: "APPROVED",
        toStatus: "PRINTED",
        action: "PRINT_ID_CARD",
        actedByUserId: user.id,
      });
    } else {
      await db.update(idCards).set({ printedAt: new Date() }).where(eq(idCards.id, id));
    }

    await audit(user, "PRINT_ID_CARD", "id_card", id, card.schoolId);
    res.json({ success: true, status: "PRINTED", printedAt: new Date() });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/bulk-print", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardIds: number[] = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];
    if (cardIds.length === 0) return res.status(400).json({ error: "cardIds array is required" });

    const cards = await db.select().from(idCards).where(inArray(idCards.id, cardIds));
    for (const card of cards) {
      if (!canReadSchool(user, card.schoolId)) {
        return res.status(403).json({ error: `Access denied to card #${card.id}` });
      }
      if (card.status !== "APPROVED" && card.status !== "PRINTED") {
        return res.status(400).json({ error: `Card #${card.cardNumber} is not APPROVED (status: ${card.status})` });
      }
    }

    for (const card of cards) {
      if (card.status === "APPROVED") {
        await db.update(idCards).set({ status: "PRINTED", printedAt: new Date() }).where(eq(idCards.id, card.id));
        await db.insert(approvalHistory).values({
          idCardId: card.id,
          fromStatus: "APPROVED",
          toStatus: "PRINTED",
          action: "PRINT_ID_CARD",
          actedByUserId: user.id,
        });
      } else {
        await db.update(idCards).set({ printedAt: new Date() }).where(eq(idCards.id, card.id));
      }
      await audit(user, "PRINT_ID_CARD", "id_card", card.id, card.schoolId);
    }

    res.json({ success: true, count: cards.length });
  } catch (e) {
    fail(res, e);
  }
});

// ─── PDF GENERATION ───────────────────────────────────────────────────────
async function fetchCardPdfData(db: any, cardId: number): Promise<CardPdfData | null> {
  const card = (await db.select().from(idCards).where(eq(idCards.id, cardId)))[0];
  if (!card) return null;
  const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, card.templateId)))[0];
  if (!template) return null;
  const elements = (await db.select().from(templateElements).where(eq(templateElements.templateId, template.id))).map(normalizeTemplateElement);
  const dataRows = await db.select().from(idCardData).where(eq(idCardData.idCardId, card.id));
  const cardData: Record<string, string> = { cardNumber: card.cardNumber };
  for (const d of dataRows) cardData[d.fieldKey] = d.fieldValue || "";

  return {
    cardNumber: card.cardNumber,
    template: {
      cardWidth: template.cardWidth || 324,
      cardHeight: template.cardHeight || 204,
      orientation: template.orientation || "landscape",
      elements: elements.map((el: any) => ({
        elementKey: el.elementKey,
        elementType: el.elementType,
        label: el.label,
        config: el.config,
        sortOrder: el.sortOrder,
      })),
    },
    cardData,
  };
}

router.get("/id-cards/:id/pdf", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card || !canReadSchool(user, card.schoolId)) return res.status(404).json({ error: "ID card not found" });

    const pdfData = await fetchCardPdfData(db, id);
    if (!pdfData) return res.status(404).json({ error: "Template or card data missing for PDF" });

    const pdfBuffer = await generateSingleCardPdf(pdfData);
    await audit(user, "DOWNLOAD_ID_CARD_PDF", "id_card", id, card.schoolId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="id_card_${card.cardNumber}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/bulk-pdf", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardIds: number[] = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];
    if (cardIds.length === 0) return res.status(400).json({ error: "cardIds array is required" });

    const pdfCards: CardPdfData[] = [];
    for (const cardId of cardIds) {
      const card = (await db.select().from(idCards).where(eq(idCards.id, cardId)))[0];
      if (!card || !canReadSchool(user, card.schoolId)) {
        return res.status(403).json({ error: `Access denied to card #${cardId}` });
      }
      const item = await fetchCardPdfData(db, cardId);
      if (item) pdfCards.push(item);
    }

    if (pdfCards.length === 0) return res.status(404).json({ error: "No valid cards found for PDF" });

    const pdfBuffer = await generateBulkCardPdf(pdfCards);
    await audit(user, "DOWNLOAD_ID_CARD_PDF", "id_card", null, null, { count: pdfCards.length });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="bulk_id_cards_${Date.now()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (e) {
    fail(res, e);
  }
});

// ─── FILE METADATA ────────────────────────────────────────────────────────
router.post("/id-cards/:id/files", requireRole(adminRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card || !canWriteSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    const { fileType, fileName, fileUrl, mimeType, fileSize } = req.body;
    if (!fileType || !fileName || !fileUrl) {
      return res.status(400).json({ error: "fileType, fileName, and fileUrl are required" });
    }

    const r = await db.insert(idCardFiles).values({
      idCardId: id,
      fileType: String(fileType),
      fileName: String(fileName),
      fileUrl: String(fileUrl),
      mimeType: mimeType ? String(mimeType) : null,
      fileSize: fileSize ? Number(fileSize) : null,
      uploadedByUserId: user.id,
    });
    const fileId = Number(r[0].insertId);
    res.status(201).json((await db.select().from(idCardFiles).where(eq(idCardFiles.id, fileId)))[0]);
  } catch (e) {
    fail(res, e);
  }
});

// ─── NOTIFICATIONS, AUDIT LOGS & APPROVALS ─────────────────────────────────
router.get("/notifications", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    res.json(
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, currentUser(res).id))
        .orderBy(desc(notifications.createdAt)),
    );
  } catch (e) {
    fail(res, e);
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, currentUser(res).id)));
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/notifications", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    await db.delete(notifications).where(eq(notifications.userId, user.id));
    res.json({ success: true, message: "Notifications cleared" });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/audit-logs", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    if (adminRoles.has(user.role)) {
      if (req.query.schoolId) {
        const sid = Number(req.query.schoolId);
        const rows = await db
          .select({
            id: auditLogs.id,
            userId: auditLogs.userId,
            schoolId: auditLogs.schoolId,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(eq(auditLogs.schoolId, sid))
          .orderBy(desc(auditLogs.id))
          .limit(200);
        return res.json(rows);
      }
      const rows = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          schoolId: auditLogs.schoolId,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .orderBy(desc(auditLogs.id))
        .limit(200);
      return res.json(rows);
    }

    // School user: strictly scoped to own school
    if (!user.schoolId) return res.json([]);
    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        schoolId: auditLogs.schoolId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.schoolId, user.schoolId))
      .orderBy(desc(auditLogs.id))
      .limit(200);
    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/audit-logs", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    if (!adminRoles.has(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions: audit logs cannot be cleared by school users" });
    }

    if (req.query.schoolId) {
      const sid = Number(req.query.schoolId);
      await db.delete(auditLogs).where(eq(auditLogs.schoolId, sid));
    } else {
      await db.delete(auditLogs);
    }
    return res.json({ success: true, message: "Audit logs cleared" });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/approvals", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);

    const baseQuery = db
      .select({
        id: idCardRequests.id,
        studentName: idCardRequests.studentName,
        admissionCode: idCardRequests.admissionCode,
        schoolId: idCardRequests.schoolId,
        schoolName: schools.name,
        status: idCardRequests.status,
        reviewNote: idCardRequests.reviewNote,
        submittedAt: idCardRequests.submittedAt,
        reviewedAt: idCardRequests.reviewedAt,
        cardId: idCards.id,
        cardNumber: idCards.cardNumber,
      })
      .from(idCardRequests)
      .innerJoin(schools, eq(idCardRequests.schoolId, schools.id))
      .leftJoin(idCards, eq(idCards.requestId, idCardRequests.id));

    if (adminRoles.has(user.role)) {
      const rows = await baseQuery.orderBy(desc(idCardRequests.createdAt));
      return res.json(rows);
    }

    if (!user.schoolId) return res.json([]);
    const rows = await baseQuery
      .where(eq(idCardRequests.schoolId, user.schoolId))
      .orderBy(desc(idCardRequests.createdAt));
    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
});

export const apiRouter = router;
