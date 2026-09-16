import { Router, type NextFunction, type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  approvalHistory,
  auditLogs,
  idCardData,
  idCardFiles,
  idCardRequests,
  idCardTemplates,
  idCards,
  notifications,
  schoolTemplates,
  templateElements,
  schools,
  users,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { authenticateApplicationRequest, clearApplicationSession, createPasswordReset, hashPassword, loginUser, resetPassword, setApplicationSession } from "./appAuth";
import { generateSingleCardPdf, generateBulkCardPdf, type CardPdfData } from "./pdf";

const router = Router();
const adminRoles = new Set(["SUPER_ADMIN"]);
const schoolManagerRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
const schoolWriteRoles = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "SCHOOL_OPERATOR"]);

function currentUser(res: Response) {
  return res.locals.user as User;
}
function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
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
  if (!db) throw new Error("Database not available");
  await db.insert(auditLogs).values({ userId: user.id > 0 ? user.id : null, schoolId, action, entityType, entityId, newValues: newValues as never });
}

async function notify(userId: number, schoolId: number | null, type: string, title: string, message: string, entityType?: string, entityId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values({ userId, schoolId, type, title, message, entityType, entityId });
}

async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    res.locals.user = await authenticateApplicationRequest(req);
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
  return res.status(500).json({ error: "Database operation failed" });
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
  } catch (e) { fail(res, e); }
});
router.post("/auth/logout", (_req, res) => { clearApplicationSession(res); res.json({ success: true }); });
router.get("/auth/me", async (req, res) => { try { const user = await authenticateApplicationRequest(req); const { passwordHash: _passwordHash, ...safeUser } = user; const db = await getDb(); const school = safeUser.schoolId && db ? (await db.select({ name: schools.name }).from(schools).where(eq(schools.id, safeUser.schoolId)))[0] : undefined; res.json({ ...safeUser, schoolName: school?.name ?? null }); } catch { res.status(401).json({ error: "Authentication required" }); } });
router.post("/auth/forgot-password", async (req, res) => { try { const email = String(req.body.email ?? "").trim().toLowerCase(); if (!email) return res.status(400).json({ error: "Email is required" }); const token = await createPasswordReset(email); res.json({ success: true, ...(ENV.isProduction || !token ? {} : { developmentResetToken: token }) }); } catch (e) { fail(res, e); } });
router.post("/auth/reset-password", async (req, res) => { try { const token = String(req.body.token ?? ""); const password = String(req.body.password ?? ""); if (!token || password.length < 8) return res.status(400).json({ error: "Token and a password of at least 8 characters are required" }); const success = await resetPassword(token, password); if (!success) return res.status(400).json({ error: "Invalid or expired reset token" }); res.json({ success: true }); } catch (e) { fail(res, e); } });

router.use(auth);

router.get("/schools", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    const rows = adminRoles.has(user.role) ? await db.select().from(schools).orderBy(desc(schools.createdAt)) : user.schoolId ? await db.select().from(schools).where(eq(schools.id, user.schoolId)) : [];
    res.json(rows);
  } catch (e) { fail(res, e); }
});

router.post("/schools", requireRole(adminRoles), async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const result = await db.insert(schools).values({ name: String(req.body.name), shortCode: String(req.body.shortCode), email: req.body.email ?? null, phone: req.body.phone ?? null, address: req.body.address ?? null });
    const id = Number(result[0].insertId);
    await audit(currentUser(res), "CREATE_SCHOOL", "school", id, id, req.body);
    res.status(201).json((await db.select().from(schools).where(eq(schools.id, id)))[0]);
  } catch (e) { fail(res, e); }
});

router.get("/schools/:id", async (req, res) => {
  try {
    const id = requestedSchoolId(currentUser(res), req.params.id);
    if (!id) return res.status(403).json({ error: "School access denied" });
    const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" });
    const row = (await db.select().from(schools).where(eq(schools.id, id)))[0];
    return row ? res.json(row) : res.status(404).json({ error: "School not found" });
  } catch (e) { fail(res, e); }
});

router.put("/schools/:id", requireRole(schoolManagerRoles), async (req, res) => {
  try {
    const user = currentUser(res); const id = requestedSchoolId(user, req.params.id);
    if (!id || !canManageSchool(user, id)) return res.status(403).json({ error: "School access denied" });
    const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" });
    await db.update(schools).set({ name: req.body.name, shortCode: req.body.shortCode, email: req.body.email, phone: req.body.phone, address: req.body.address }).where(eq(schools.id, id));
    await audit(user, "UPDATE_SCHOOL", "school", id, id, req.body);
    res.json((await db.select().from(schools).where(eq(schools.id, id)))[0]);
  } catch (e) { fail(res, e); }
});

router.patch("/schools/:id/status", requireRole(schoolManagerRoles), async (req, res) => {
  try { const user = currentUser(res); const id = requestedSchoolId(user, req.params.id); if (!id || !canManageSchool(user, id)) return res.status(403).json({ error: "School access denied" }); const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); await db.update(schools).set({ isActive: Boolean(req.body.isActive) }).where(eq(schools.id, id)); await audit(user, "UPDATE_SCHOOL_STATUS", "school", id, id, req.body); res.json({ success: true }); } catch (e) { fail(res, e); }
});

router.delete("/schools/:id", requireRole(adminRoles), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid school id" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    // Audit before deletion so foreign key constraint on audit_logs.schoolId is valid
    await audit(currentUser(res), "DELETE_SCHOOL", "school", id, null, null);
    // Cleanly delete dependent idCardRequests and unbind users before school deletion
    await db.delete(idCardRequests).where(eq(idCardRequests.schoolId, id));
    await db.update(users).set({ schoolId: null }).where(eq(users.schoolId, id));
    await db.delete(schools).where(eq(schools.id, id));
    res.status(200).json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/users", async (_req, res) => {
  try { const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); const user = currentUser(res); const rows = adminRoles.has(user.role) ? await db.select().from(users).orderBy(desc(users.createdAt)) : user.schoolId ? await db.select().from(users).where(eq(users.schoolId, user.schoolId)).orderBy(desc(users.createdAt)) : []; res.json(rows.map(safeUser)); } catch (e) { fail(res, e); }
});

router.post("/users", requireRole(schoolManagerRoles), async (req, res) => {
  try { const actor = currentUser(res); const schoolId = adminRoles.has(actor.role) ? Number(req.body.schoolId) : actor.schoolId; if (!schoolId) return res.status(400).json({ error: "schoolId is required" }); if (String(req.body.password ?? "").length < 8) return res.status(400).json({ error: "A password of at least 8 characters is required" }); const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); const result = await db.insert(users).values({ openId: String(req.body.openId ?? `local_${Date.now()}`), name: req.body.name ?? null, email: req.body.email ?? null, loginMethod: "local", passwordHash: req.body.password ? await hashPassword(String(req.body.password)) : null, role: req.body.role ?? "VIEWER", schoolId }); const id = Number(result[0].insertId); await audit(actor, "CREATE_USER", "user", id, schoolId, req.body); res.status(201).json(safeUser((await db.select().from(users).where(eq(users.id, id)))[0])); } catch (e) { fail(res, e); }
});

router.get("/users/:id", async (req, res) => {
  try { const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); const target = (await db.select().from(users).where(eq(users.id, Number(req.params.id))))[0]; if (!target || !canReadSchool(currentUser(res), target.schoolId ?? undefined)) return res.status(404).json({ error: "User not found" }); res.json(safeUser(target)); } catch (e) { fail(res, e); }
});
router.put("/users/:id", requireRole(schoolManagerRoles), async (req, res) => {
  try { const actor = currentUser(res); const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); const id = Number(req.params.id); const target = (await db.select().from(users).where(eq(users.id, id)))[0]; if (!target || !canManageSchool(actor, target.schoolId ?? undefined)) return res.status(403).json({ error: "User access denied" }); const nextSchoolId = adminRoles.has(actor.role) ? (req.body.schoolId ?? target.schoolId) : target.schoolId; await db.update(users).set({ name: req.body.name, email: req.body.email, role: req.body.role, schoolId: nextSchoolId }).where(eq(users.id, id)); await audit(actor, "UPDATE_USER", "user", id, target.schoolId, req.body); res.json(safeUser((await db.select().from(users).where(eq(users.id, id)))[0])); } catch (e) { fail(res, e); }
});
router.patch("/users/:id/status", requireRole(schoolManagerRoles), async (req, res) => { try { const actor = currentUser(res); const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); const id = Number(req.params.id); const target = (await db.select().from(users).where(eq(users.id, id)))[0]; if (!target || !canManageSchool(actor, target.schoolId ?? undefined)) return res.status(403).json({ error: "User access denied" }); await db.update(users).set({ isActive: Boolean(req.body.isActive) }).where(eq(users.id, id)); await audit(actor, "UPDATE_USER_STATUS", "user", id, target.schoolId, req.body); res.json({ success: true }); } catch (e) { fail(res, e); } });
router.delete("/users/:id", requireRole(schoolManagerRoles), async (req, res) => { try { const actor = currentUser(res); const db = await getDb(); if (!db) return res.status(503).json({ error: "Database not available" }); const id = Number(req.params.id); const target = (await db.select().from(users).where(eq(users.id, id)))[0]; if (!target || !canManageSchool(actor, target.schoolId ?? undefined)) return res.status(403).json({ error: "User access denied" }); await db.delete(users).where(eq(users.id, id)); await audit(actor, "DELETE_USER", "user", id, target.schoolId); res.status(204).end(); } catch (e) { fail(res, e); } });

router.get("/templates", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const user = currentUser(res);
    const tmplList = adminRoles.has(user.role)
      ? await db.select().from(idCardTemplates).orderBy(desc(idCardTemplates.createdAt))
      : await db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).orderBy(desc(idCardTemplates.createdAt));

    const allElements = await db.select().from(templateElements);
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
    const elements = await db.select().from(templateElements).where(eq(templateElements.templateId, id));
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
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
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
              config: element.config as never,
              sortOrder: element.sortOrder ?? i,
            })
            .where(eq(templateElements.id, existing.id));
        } else {
          await db.insert(templateElements).values({
            templateId: id,
            elementKey: element.elementKey,
            elementType: element.elementType,
            label: element.label ?? null,
            config: element.config as never,
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
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    await audit(currentUser(res), "DELETE_TEMPLATE", "template", id, null);
    await db.delete(templateElements).where(eq(templateElements.templateId, id));
    await db.delete(schoolTemplates).where(eq(schoolTemplates.templateId, id));
    await db.update(idCards).set({ templateId: null as unknown as number }).where(eq(idCards.templateId, id));
    await db.delete(idCardTemplates).where(eq(idCardTemplates.id, id));
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

router.post("/upload", async (req, res) => {
  try {
    const { filename, contentType, dataBase64 } = req.body;
    if (!dataBase64) return res.status(400).json({ error: "dataBase64 is required" });
    const mime = String(contentType || "image/png").toLowerCase();
    if (!mime.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type. Only image uploads are allowed." });
    }
    if (typeof dataBase64 === "string" && dataBase64.length > 7 * 1024 * 1024) {
      return res.status(400).json({ error: "File exceeds 5MB size limit" });
    }
    const buffer = Buffer.from(dataBase64, "base64");
    const name = filename || `upload_${Date.now()}.png`;

    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const { storagePut } = await import("./storage");
        const stored = await storagePut(`templates/${name}`, buffer, mime);
        return res.json({ url: stored.url });
      } catch (err) {
        console.warn("[Upload] Storage failed, falling back to data URL", err);
      }
    }
    const dataUrl = `data:${mime};base64,${dataBase64}`;
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
    if (existing) await db.update(schoolTemplates).set({ isDefault: true, assignedByUserId: user.id }).where(eq(schoolTemplates.id, existing.id));
    else await db.insert(schoolTemplates).values({ schoolId, templateId, isDefault: true, assignedByUserId: user.id });
    await audit(user, "SELECT_TEMPLATE", "school_template", existing?.id ?? null, schoolId, { templateId });
    res.json({ success: true });
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
      map[d.fieldKey] = d.fieldValue || "";
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

router.post("/id-cards", requireRole(schoolWriteRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });

    // Anti-spoofing: Non-super-admins strictly use user.schoolId
    const schoolId = adminRoles.has(user.role)
      ? Number(req.body.schoolId || user.schoolId)
      : user.schoolId;

    if (!schoolId) return res.status(400).json({ error: "schoolId is required" });

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
    const elements = template ? await db.select().from(templateElements).where(eq(templateElements.templateId, template.id)) : [];

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

router.put("/id-cards/:id", requireRole(schoolWriteRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card || !canWriteSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    // Strict rule: Approved cards are read-only to normal school users
    if (card.status !== "DRAFT" && card.status !== "CHANGES_REQUIRED" && !adminRoles.has(user.role)) {
      return res.status(400).json({
        error: `Cannot edit card in ${card.status} status. Only DRAFT or CHANGES_REQUIRED cards can be edited.`,
      });
    }

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

router.delete("/id-cards/:id", requireRole(schoolWriteRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const id = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, id)))[0];
    if (!card || !canWriteSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    // Strict rule: Only DRAFT cards can be deleted
    if (card.status !== "DRAFT" && !adminRoles.has(user.role)) {
      return res.status(400).json({ error: "Only DRAFT ID cards can be deleted" });
    }

    await db.delete(idCards).where(eq(idCards.id, id));
    await audit(user, "DELETE_ID_CARD", "id_card", id, card.schoolId);
    res.status(204).end();
  } catch (e) {
    fail(res, e);
  }
});

// ─── SUBMISSION & TRANSITIONS ──────────────────────────────────────────────
router.post("/id-cards/:id/submit", requireRole(schoolWriteRoles), async (req, res) => {
  try {
    const user = currentUser(res);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const cardId = Number(req.params.id);
    const card = (await db.select().from(idCards).where(eq(idCards.id, cardId)))[0];
    if (!card || !canWriteSchool(user, card.schoolId)) return res.status(403).json({ error: "ID card access denied" });

    // Allowed transition check
    if (card.status !== "DRAFT" && card.status !== "CHANGES_REQUIRED") {
      return res.status(400).json({ error: `Cannot submit card in ${card.status} status. Invalid transition.` });
    }

    // Validate template exists and dynamic requirements
    const template = (await db.select().from(idCardTemplates).where(eq(idCardTemplates.id, card.templateId)))[0];
    if (!template) return res.status(400).json({ error: "Template no longer exists" });

    const elements = await db.select().from(templateElements).where(eq(templateElements.templateId, template.id));
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
    if (requestId) {
      await db
        .update(idCardRequests)
        .set({
          studentName,
          status: targetStatus,
          submittedAt: new Date(),
          requestedByUserId: user.id,
        })
        .where(eq(idCardRequests.id, requestId));
    } else {
      const result = await db.insert(idCardRequests).values({
        studentName,
        admissionCode,
        schoolId: card.schoolId,
        status: targetStatus,
        requestedByUserId: user.id,
        templateId: card.templateId,
        submittedAt: new Date(),
      });
      requestId = Number(result[0].insertId);
      await db.update(idCards).set({ requestId }).where(eq(idCards.id, cardId));
    }

    await db.update(idCards).set({ status: targetStatus, submittedByUserId: user.id }).where(eq(idCards.id, cardId));

    await db.insert(approvalHistory).values({
      idCardId: cardId,
      fromStatus: card.status,
      toStatus: targetStatus,
      action,
      actedByUserId: user.id,
    });

    await audit(user, action, "id_card", cardId, card.schoolId, { requestId, status: targetStatus });

    // Notify admins of submission
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
    for (const a of admins) {
      await notify(
        a.id,
        card.schoolId,
        action,
        `Card ${targetStatus.toLowerCase()}: ${card.cardNumber}`,
        `${studentName}'s ID card was submitted for approval`,
        "id_card",
        cardId,
      );
    }

    res.json({ success: true, requestId, status: targetStatus });
  } catch (e) {
    fail(res, e);
  }
});

// ─── ADMIN APPROVAL & REVIEW TRANSITIONS ──────────────────────────────────
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

  let request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, paramId)))[0];
  let card = (await db.select().from(idCards).where(eq(idCards.id, paramId)))[0];

  if (request && !card) {
    card = (await db.select().from(idCards).where(eq(idCards.requestId, request.id)))[0];
  } else if (card && !request && card.requestId) {
    request = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, card.requestId)))[0];
  }

  const schoolId = card?.schoolId ?? request?.schoolId;
  if (!schoolId) return res.status(404).json({ error: "Record not found" });

  if (targetStatus !== "RESUBMITTED" && !adminRoles.has(user.role)) {
    return res.status(403).json({ error: "Only administrators can review, approve, or reject cards" });
  }
  if (targetStatus === "RESUBMITTED" && !canWriteSchool(user, schoolId)) {
    return res.status(403).json({ error: "School access denied" });
  }

  if (targetStatus === "CHANGES_REQUIRED" && !comment?.trim()) {
    return res.status(400).json({ error: "A comment is required when requesting changes" });
  }
  if (targetStatus === "REJECTED" && !comment?.trim()) {
    return res.status(400).json({ error: "A reason is required when rejecting a card" });
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
    if (currentStatus !== "CHANGES_REQUIRED") {
      return res.status(400).json({ error: `Cannot resubmit card in ${currentStatus} status. Must be CHANGES_REQUIRED.` });
    }
  }

  if (request) {
    await db
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
    await db
      .update(idCards)
      .set({
        status: targetStatus,
        approvedByUserId: targetStatus === "APPROVED" ? user.id : card.approvedByUserId,
      })
      .where(eq(idCards.id, card.id));

    await db.insert(approvalHistory).values({
      idCardId: card.id,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      action,
      comments: comment ?? null,
      actedByUserId: user.id,
    });

    await audit(user, action, "id_card", card.id, card.schoolId, {
      requestId: request?.id,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      comment,
    });
  } else if (request) {
    await audit(user, action, "id_card_request", request.id, request.schoolId, {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      comment,
    });
  }

  // Send notifications
  if (targetStatus === "RESUBMITTED") {
    const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
    for (const a of adminUsers) {
      await notify(
        a.id,
        schoolId,
        action,
        `Card Resubmitted: #${card?.cardNumber ?? request?.admissionCode}`,
        `School resubmitted card for review`,
        "id_card",
        card?.id ?? request?.id,
      );
    }
  } else {
    const schoolUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, schoolId));
    for (const s of schoolUsers) {
      await notify(
        s.id,
        schoolId,
        action,
        `ID card ${targetStatus.toLowerCase().replaceAll("_", " ")}: #${card?.cardNumber ?? request?.admissionCode}`,
        comment ?? `ID card status changed to ${targetStatus}`,
        "id_card",
        card?.id ?? request?.id,
      );
    }
  }

  res.json({ success: true, status: targetStatus });
}

// Approval endpoints (both /api/approvals and /api/id-cards)
router.post("/approvals/:id/review", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "UNDER_REVIEW", "START_REVIEW");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/request-changes", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "CHANGES_REQUIRED", "REQUEST_CHANGES", req.body.comment || req.body.note);
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/resubmit", requireRole(schoolWriteRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "RESUBMITTED", "RESUBMIT_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/approve", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "APPROVED", "APPROVE_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/approvals/:id/reject", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment);
  } catch (e) {
    fail(res, e);
  }
});

router.post("/id-cards/:id/review", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "UNDER_REVIEW", "START_REVIEW");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/request-changes", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "CHANGES_REQUIRED", "REQUEST_CHANGES", req.body.comment || req.body.note);
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/resubmit", requireRole(schoolWriteRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "RESUBMITTED", "RESUBMIT_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/approve", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "APPROVED", "APPROVE_ID_CARD");
  } catch (e) {
    fail(res, e);
  }
});
router.post("/id-cards/:id/reject", requireRole(adminRoles), async (req, res) => {
  try {
    await transitionApproval(req, res, "REJECTED", "REJECT_ID_CARD", req.body.reason || req.body.comment);
  } catch (e) {
    fail(res, e);
  }
});

// ─── PRINTING ─────────────────────────────────────────────────────────────
router.post("/id-cards/:id/print", requireRole(schoolWriteRoles), async (req, res) => {
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

router.post("/id-cards/bulk-print", requireRole(schoolWriteRoles), async (req, res) => {
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
  const elements = await db.select().from(templateElements).where(eq(templateElements.templateId, template.id));
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

router.get("/id-cards/:id/pdf", async (req, res) => {
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

router.post("/id-cards/bulk-pdf", async (req, res) => {
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
router.post("/id-cards/:id/files", requireRole(schoolWriteRoles), async (req, res) => {
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

router.get("/audit-logs", requireRole(adminRoles), async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    res.json(await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/approvals", requireRole(adminRoles), async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database not available" });
    const rows = await db
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
      .leftJoin(idCards, eq(idCards.requestId, idCardRequests.id))
      .orderBy(desc(idCardRequests.createdAt));
    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
});

export const apiRouter = router;

