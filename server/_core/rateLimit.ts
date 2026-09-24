import type { NextFunction, Request, Response } from "express";

type Entry = { count: number; resetAt: number };

export function createRateLimiter(options: { windowMs: number; max: number }) {
  const entries = new Map<string, Entry>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== "production") return next();

    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
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
