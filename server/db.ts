import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  idCardRequests,
  idCardTemplates,
  InsertUser,
  schools,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'SUPER_ADMIN';
      updateSet.role = 'SUPER_ADMIN';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// --- Schools ---------------------------------------------------------------

export async function listSchools(schoolId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (schoolId) {
    return db.select().from(schools).where(eq(schools.id, schoolId));
  }
  return db.select().from(schools).orderBy(desc(schools.createdAt));
}

// --- ID card templates -------------------------------------------------------

export async function listIdCardTemplates(onlyActive = false) {
  const db = await getDb();
  if (!db) return [];
  if (onlyActive) {
    return db.select().from(idCardTemplates).where(eq(idCardTemplates.status, "ACTIVE")).orderBy(desc(idCardTemplates.createdAt));
  }
  return db.select().from(idCardTemplates).orderBy(desc(idCardTemplates.createdAt));
}

// --- ID card requests --------------------------------------------------------

export async function listIdCardRequests(schoolId?: number) {
  const db = await getDb();
  if (!db) return [];

  const query = db
    .select({
      id: idCardRequests.id,
      studentName: idCardRequests.studentName,
      admissionCode: idCardRequests.admissionCode,
      status: idCardRequests.status,
      reviewNote: idCardRequests.reviewNote,
      submittedAt: idCardRequests.submittedAt,
      reviewedAt: idCardRequests.reviewedAt,
      schoolId: idCardRequests.schoolId,
      schoolName: schools.name,
    })
    .from(idCardRequests)
    .innerJoin(schools, eq(idCardRequests.schoolId, schools.id));

  if (schoolId) {
    return query.where(eq(idCardRequests.schoolId, schoolId)).orderBy(desc(idCardRequests.submittedAt));
  }

  return query.orderBy(desc(idCardRequests.submittedAt));
}

export async function approveIdCardRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(idCardRequests)
    .set({ status: "APPROVED", reviewedAt: new Date(), reviewNote: null })
    .where(eq(idCardRequests.id, id));
}

export async function requestChangesForIdCardRequest(id: number, note: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(idCardRequests)
    .set({ status: "CHANGES_REQUIRED", reviewedAt: new Date(), reviewNote: note })
    .where(eq(idCardRequests.id, id));
}

// TODO: add feature queries here as your schema grows.
