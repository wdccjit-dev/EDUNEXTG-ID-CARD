import "dotenv/config";
import { eq, or } from "drizzle-orm";
import { getDb } from "../server/db";
import { hashPassword } from "../server/appAuth";
import { schools, users } from "../drizzle/schema";

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@edunextg.com";
const schoolEmail = process.env.SEED_SCHOOL_EMAIL ?? "school@example.test";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Duronto321";
const schoolPassword = process.env.SEED_SCHOOL_PASSWORD ?? "School123!";

const dbInstance = await getDb();
if (!dbInstance) throw new Error("Database is unavailable. Check DATABASE_URL and ensure MySQL is running.");
const db = dbInstance;

const configuredSchoolId = process.env.SEED_SCHOOL_ID ? Number(process.env.SEED_SCHOOL_ID) : undefined;
let school = configuredSchoolId
  ? (await db.select().from(schools).where(eq(schools.id, configuredSchoolId)))[0]
  : (await db.select().from(schools).limit(1))[0];

if (!school) {
  console.log("No school found. Creating default 'Greenwood High School'...");
  const [res] = await db.insert(schools).values({
    name: "Greenwood High School",
    shortCode: "GWHS",
    email: "admin@greenwood.edu",
    phone: "+1 555-0199",
    address: "100 Education Lane",
    isActive: true,
  });
  school = (await db.select().from(schools).where(eq(schools.id, Number(res.insertId))))[0];
}


async function upsertAccount(input: { openId: string; email: string; name: string; role: "SUPER_ADMIN" | "SCHOOL_ADMIN"; schoolId: number | null; password: string }) {
  const passwordHash = await hashPassword(input.password);
  const existing = (
    await db
      .select()
      .from(users)
      .where(or(eq(users.openId, input.openId), eq(users.email, input.email)))
  )[0];
  if (existing) {
    await db
      .update(users)
      .set({
        openId: input.openId,
        email: input.email,
        name: input.name,
        role: input.role,
        schoolId: input.schoolId,
        passwordHash,
        isActive: true,
        loginMethod: "local",
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(users).values({ openId: input.openId, email: input.email, name: input.name, role: input.role, schoolId: input.schoolId, loginMethod: "local", passwordHash });
  return Number(result[0].insertId);
}

const adminId = await upsertAccount({ openId: "seed_admin", email: adminEmail, name: "Development Admin", role: "SUPER_ADMIN", schoolId: null, password: adminPassword });
const schoolAdminId = await upsertAccount({ openId: "seed_school_admin", email: schoolEmail, name: "Development School Admin", role: "SCHOOL_ADMIN", schoolId: school.id, password: schoolPassword });
console.log(`Seeded admin #${adminId}: ${adminEmail} / ${adminPassword}`);
console.log(`Seeded school admin #${schoolAdminId}: ${schoolEmail} / ${schoolPassword} (school #${school.id}: ${school.name})`);
