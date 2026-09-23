import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { eq, gt, and, or, sql } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { passwordResets, users, schools, type User } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const RESET_TTL_MS = 1000 * 60 * 60;

function secretKey() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters for application authentication");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored?: string | null): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length < 3) return false;
    const [, salt, expectedHex] = parts;
    if (!salt || !expectedHex) return false;
    const actual = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  if (stored.includes(":")) {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return timingSafeEqual(Buffer.from(key, "hex"), derived);
  }
  return false;
}

export function getPasswordFingerprint(passwordHash?: string | null): string {
  if (!passwordHash) return "";
  return passwordHash.slice(-16);
}

export async function signApplicationSession(user: User): Promise<string> {
  const pwdHash = getPasswordFingerprint(user.passwordHash);
  return new SignJWT({
    type: "application",
    openId: user.openId,
    appRole: user.role,
    role: user.role,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    pwdHash,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_MS / 1000}s`)
    .sign(secretKey());
}

export async function authenticateApplicationRequest(req: Request): Promise<User | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secretKey());
    const payload = verified.payload;
    const db = await getDb();
    if (!db) return null;
    let user: User | undefined;
    if (typeof payload.userId === "number") {
      user = (await db.select().from(users).where(eq(users.id, payload.userId)))[0];
    } else if (payload.openId) {
      user = (await db.select().from(users).where(eq(users.openId, String(payload.openId))))[0];
    }
    if (!user || !user.isActive) return null;
    if (user.schoolId && user.role !== "SUPER_ADMIN") {
      const school = (await db.select({ isActive: schools.isActive }).from(schools).where(eq(schools.id, user.schoolId)))[0];
      if (school && !school.isActive) {
        return null;
      }
    }
    if (payload.pwdHash && typeof payload.pwdHash === "string") {
      const currentFingerprint = getPasswordFingerprint(user.passwordHash);
      if (payload.pwdHash !== currentFingerprint) {
        return null;
      }
    }
    return user;
  } catch {
    return null;
  }
}

export async function setApplicationSession(res: Response, token: string) {
  try {
    if (typeof res?.cookie === "function") {
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV.isProduction,
        maxAge: SESSION_TTL_MS,
        path: "/",
      });
    }
  } catch {
    // Safely ignore in simulated test environments
  }
}

export function clearApplicationSession(res: Response) {
  try {
    if (typeof res?.clearCookie === "function") {
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV.isProduction,
        path: "/",
      });
    }
  } catch {
    // Safely ignore in simulated test environments
  }
}


export async function loginUser(identifier: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rawClean = identifier.trim();
  const clean = rawClean.toLowerCase();
  // Match either exact email, exact openId (case-insensitive)
  const user = (
    await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, clean),
          eq(users.openId, rawClean),
          eq(users.openId, clean),
          sql`LOWER(${users.openId}) = ${clean}`
        )
      )
  )[0];
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) return null;
  if (user.schoolId && user.role !== "SUPER_ADMIN") {
    const school = (await db.select({ isActive: schools.isActive }).from(schools).where(eq(schools.id, user.schoolId)))[0];
    if (school && !school.isActive) {
      const err: any = new Error("This school account is currently inactive. Please contact the administrator.");
      err.statusCode = 403;
      err.isSchoolInactive = true;
      throw err;
    }
  }
  const token = await signApplicationSession(user);
  return { user, token };
}

export async function createPasswordReset(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const user = (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())))[0];
  if (!user) return null;
  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({ userId: user.id, tokenHash: (await hashPassword(rawToken)), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  return rawToken;
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const candidates = await db.select().from(passwordResets).where(gt(passwordResets.expiresAt, new Date()));
  for (const reset of candidates) {
    if (reset.usedAt || !(await verifyPassword(rawToken, reset.tokenHash))) continue;
    await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, reset.userId));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.id, reset.id), eq(passwordResets.userId, reset.userId)));
    return true;
  }
  return false;
}
