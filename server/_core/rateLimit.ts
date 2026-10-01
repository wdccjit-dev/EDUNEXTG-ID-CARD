import type { NextFunction, Request, Response } from "express";

type Entry = { count: number; resetAt: number };

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const entries = new Map<string, Entry>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.DISABLE_RATE_LIMIT === "1") return next();

    const now = Date.now();
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : req.ip || req.socket.remoteAddress || "unknown";
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    entry.count += 1;
    entries.set(key, entry);

    if (entry.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    // Opportunistic cleanup keeps the in-memory map bounded without a timer.
    if (entries.size > 5_000) {
      entries.forEach((value, entryKey) => {
        if (value.resetAt <= now) entries.delete(entryKey);
      });
    }
    next();
  };
}

// In-memory per-account failed login tracker.
// Note: Resets on process restart and is per-process (not shared across cluster instances).
const accountFailureEntries = new Map<string, Entry>();
const ACCOUNT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_FAILURE_MAX = 10;

function normalizeAccountKey(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export function checkAccountLockout(identifier: string): { locked: boolean; retryAfterSeconds: number } {
  if (process.env.DISABLE_RATE_LIMIT === "1") {
    return { locked: false, retryAfterSeconds: 0 };
  }

  const key = normalizeAccountKey(identifier);
  if (!key) return { locked: false, retryAfterSeconds: 0 };

  const now = Date.now();
  const entry = accountFailureEntries.get(key);
  if (!entry) return { locked: false, retryAfterSeconds: 0 };

  if (entry.resetAt <= now) {
    accountFailureEntries.delete(key);
    return { locked: false, retryAfterSeconds: 0 };
  }

  if (entry.count >= ACCOUNT_FAILURE_MAX) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { locked: true, retryAfterSeconds };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

export function recordAccountLoginFailure(identifier: string): void {
  if (process.env.DISABLE_RATE_LIMIT === "1") return;

  const key = normalizeAccountKey(identifier);
  if (!key) return;

  const now = Date.now();
  const current = accountFailureEntries.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + ACCOUNT_FAILURE_WINDOW_MS }
    : current;

  entry.count += 1;
  accountFailureEntries.set(key, entry);

  // Opportunistic cleanup keeps the in-memory map bounded without a timer.
  if (accountFailureEntries.size > 5_000) {
    accountFailureEntries.forEach((value, entryKey) => {
      if (value.resetAt <= now) accountFailureEntries.delete(entryKey);
    });
  }
}

export function resetAccountLoginFailure(identifier: string): void {
  const key = normalizeAccountKey(identifier);
  if (!key) return;
  accountFailureEntries.delete(key);
}

