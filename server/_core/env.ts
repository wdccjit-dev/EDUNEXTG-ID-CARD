export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

export function validateRuntimeEnvironment() {
  const errors: string[] = [];

  if (!ENV.databaseUrl) {
    errors.push("DATABASE_URL is required");
  } else {
    try {
      const url = new URL(ENV.databaseUrl);
      if (url.protocol !== "mysql:") errors.push("DATABASE_URL must use the mysql:// protocol");
    } catch {
      errors.push("DATABASE_URL must be a valid MySQL connection URL");
    }
  }

  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    errors.push("JWT_SECRET must contain at least 32 characters");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join("\n- ")}`);
  }
}
