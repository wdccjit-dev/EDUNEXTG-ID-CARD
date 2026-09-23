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
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api", apiRouter);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
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
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

startServer().catch(console.error);
