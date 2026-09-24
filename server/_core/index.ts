import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { apiRouter } from "../api";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { assertDatabaseReady, checkDatabaseConnection, closeDb } from "../db";
import { ENV, validateRuntimeEnvironment } from "./env";
import { createRateLimiter } from "./rateLimit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateRuntimeEnvironment();
  await assertDatabaseReady();

  const app = express();
  const server = createServer(app);
  const trustProxyValue = process.env.TRUST_PROXY?.trim() || (ENV.isProduction ? "1" : "");
  if (trustProxyValue) {
    app.set("trust proxy", /^\d+$/.test(trustProxyValue) ? Number(trustProxyValue) : trustProxyValue);
  }
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.get("/readyz", async (_req, res) => {
    const database = await checkDatabaseConnection();
    res.status(database ? 200 : 503).json({ ok: database, database });
  });
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "8mb", extended: true }));
  const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
  app.use("/api/auth/login", authRateLimiter);
  app.use("/api/auth/forgot-password", authRateLimiter);
  app.use("/api/auth/reset-password", authRateLimiter);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api", apiRouter);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const bodyParserError = error as { type?: string; status?: number };
    if (bodyParserError.type === "entity.too.large" || bodyParserError.status === 413) {
      return res.status(413).json({ error: "Request body is too large" });
    }
    console.error("[HTTP] Unhandled request error", error);
    return res.status(500).json({ error: "An internal error occurred" });
  });
  const rawPort = process.env.PORT?.trim();
  const isDev = process.env.NODE_ENV === "development";

  let port: number;
  if (rawPort) {
    const configuredPort = parseInt(rawPort, 10);
    if (isNaN(configuredPort) || configuredPort <= 0 || configuredPort > 65535) {
      throw new Error(`Invalid PORT configuration: "${rawPort}"`);
    }
    const available = await isPortAvailable(configuredPort);
    if (!available) {
      throw new Error(
        `Configured port ${configuredPort} is already in use. Please free the port or update configuration.`
      );
    }
    port = configuredPort;
  } else if (isDev) {
    port = await findAvailablePort(3000);
    if (port !== 3000) console.log(`Port 3000 is busy, using port ${port} instead for development`);
  } else {
    const defaultPort = 3000;
    const available = await isPortAvailable(defaultPort);
    if (!available) {
      throw new Error(
        `Default port ${defaultPort} is already in use. Configure PORT environment variable to specify another port.`
      );
    }
    port = defaultPort;
  }
  server.requestTimeout = 120_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 60_000;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, () => {
      server.off("error", onError);
      resolve();
    });
  });
  console.log(`Server running on http://localhost:${port}/`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] ${signal} received; shutting down`);
    const forceExit = setTimeout(() => {
      console.error("[Server] Graceful shutdown timed out");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async (error) => {
      try {
        await closeDb();
      } finally {
        clearTimeout(forceExit);
        if (error) console.error("[Server] Shutdown error", error);
        process.exit(error ? 1 : 0);
      }
    });
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("[Server] Startup failed", error);
  process.exitCode = 1;
});
