import "dotenv/config";
import { eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { users } from "../drizzle/schema";
import { hashPassword } from "../server/appAuth";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@edunextg.com")
  .trim()
  .toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Duronto321";

if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
  throw new Error(
    "SEED_ADMIN_PASSWORD must be explicitly set when setting up a production database",
  );
}

const pool = mysql.createPool(databaseUrl);
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });

  const passwordHash = await hashPassword(adminPassword);
  const existing = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.openId, "seed_admin"), eq(users.email, adminEmail)))
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(users)
      .set({
        openId: "seed_admin",
        email: adminEmail,
        name: "Administrator",
        role: "SUPER_ADMIN",
        schoolId: null,
        passwordHash,
        isActive: true,
        loginMethod: "local",
      })
      .where(eq(users.id, existing.id));
    console.log(`Updated Super Admin #${existing.id}: ${adminEmail}`);
  } else {
    const [result] = await db.insert(users).values({
      openId: "seed_admin",
      email: adminEmail,
      name: "Administrator",
      role: "SUPER_ADMIN",
      schoolId: null,
      passwordHash,
      isActive: true,
      loginMethod: "local",
    });
    console.log(`Created Super Admin #${result.insertId}: ${adminEmail}`);
  }
} finally {
  await pool.end();
}
