import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { eq, gt, and, or } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { passwordResets, users, type User } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const RESET_TTL_MS = 1000 * 60 * 60;

function secretKey() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters for application authentication");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function signApplicationSession(user: User) {
  return new SignJWT({ type: "application", userId: user.id, role: user.role, schoolId: user.schoolId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1000))
    .sign(secretKey());
}

export function setApplicationSession(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: ENV.isProduction, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS });
}

export function clearApplicationSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: ENV.isProduction, sameSite: "lax", path: "/" });
}

function readSessionToken(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return cookies[COOKIE_NAME] ?? (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);
}

export async function authenticateApplicationRequest(req: Request): Promise<User> {
  const token = readSessionToken(req);
  if (!token) throw new Error("Authentication required");
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
  if (payload.type !== "application" || typeof payload.userId !== "number") throw new Error("Invalid application session");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const user = (await db.select().from(users).where(eq(users.id, payload.userId)))[0];
  if (!user || !user.isActive || !user.passwordHash) throw new Error("Account unavailable");
  return user;
}

export async function loginUser(identifier: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const clean = identifier.trim().toLowerCase();
  // Match either exact email, exact openId, or email before @
  const user = (
    await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, clean),
          eq(users.openId, clean),
          eq(users.openId, `seed_${clean}`),
          eq(users.email, `${clean}@edunextg.com`),
          eq(users.email, `${clean}@example.test`)
        )
      )
  )[0];
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) return null;
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
