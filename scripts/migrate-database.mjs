import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = mysql.createPool(databaseUrl);

async function checkColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function checkTable(tableName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

async function ensureSchemaIntegrity() {
  console.log("Verifying schema integrity...");

  // 1. Verify id_cards.removed_at
  if (!(await checkColumn("id_cards", "removed_at"))) {
    console.log("Adding missing column id_cards.removed_at...");
    await pool.query("ALTER TABLE `id_cards` ADD COLUMN `removed_at` timestamp NULL");
  }

  // 2. Verify id_cards.removed_by_user_id
  if (!(await checkColumn("id_cards", "removed_by_user_id"))) {
    console.log("Adding missing column id_cards.removed_by_user_id...");
    await pool.query("ALTER TABLE `id_cards` ADD COLUMN `removed_by_user_id` int NULL");
  }

  // 3. Verify audit_logs.actor_role
  if (!(await checkColumn("audit_logs", "actor_role"))) {
    console.log("Adding missing column audit_logs.actor_role...");
    await pool.query("ALTER TABLE `audit_logs` ADD COLUMN `actor_role` varchar(64) NULL");
  }

  // 4. Verify users.role enum includes MARKETING_ADMIN
  try {
    await pool.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` enum('SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER','MARKETING_ADMIN') NOT NULL DEFAULT 'VIEWER'",
    );
  } catch (e) {
    console.warn("Could not modify users.role enum:", e.message);
  }

  // 5. Verify idCardTemplates.cardType
  if (!(await checkColumn("idCardTemplates", "cardType"))) {
    console.log("Adding missing column idCardTemplates.cardType...");
    await pool.query(
      "ALTER TABLE `idCardTemplates` ADD COLUMN `cardType` enum('student','staff') DEFAULT 'student' NOT NULL",
    );
  }

  // 6. Verify orders table
  if (!(await checkTable("orders"))) {
    console.log("Creating missing table orders...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`orders\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`order_number\` varchar(64) NOT NULL,
        \`placed_by_user_id\` int,
        \`placed_by_role\` varchar(64) NOT NULL,
        \`placed_by_name\` varchar(191) NOT NULL,
        \`school_id\` int NOT NULL,
        \`order_type\` enum('STUDENT','STAFF') NOT NULL,
        \`hook_type\` varchar(64),
        \`clip\` boolean NOT NULL DEFAULT false,
        \`class_name\` varchar(64),
        \`section\` varchar(64),
        \`quantity\` int NOT NULL,
        \`print_sides\` enum('SINGLE','DOUBLE') NOT NULL,
        \`card_material\` enum('PVC_STANDARD','PVC_PREMIUM') NOT NULL,
        \`lanyard_included\` boolean NOT NULL DEFAULT false,
        \`lanyard_color\` varchar(64),
        \`needed_by_date\` varchar(32),
        \`delivery_address\` text,
        \`contact_person\` varchar(191),
        \`contact_phone\` varchar(32),
        \`notes\` text,
        \`status\` enum('PLACED','CONFIRMED','IN_PRODUCTION','DISPATCHED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PLACED',
        \`status_note\` text,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`orders_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`orders_order_number_unique\` UNIQUE(\`order_number\`)
      )
    `);
  }

  // 7. Verify removed_cards_history table
  if (!(await checkTable("removed_cards_history"))) {
    console.log("Creating missing table removed_cards_history...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`removed_cards_history\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`id_card_id\` int NOT NULL,
        \`school_id\` int NOT NULL,
        \`card_number\` varchar(64) NOT NULL,
        \`student_name\` varchar(191),
        \`class_name\` varchar(64),
        \`section\` varchar(64),
        \`template_name\` varchar(191),
        \`previous_status\` varchar(64) NOT NULL,
        \`removed_by_user_id\` int,
        \`removed_by_name\` varchar(191),
        \`removed_by_role\` varchar(64),
        \`removed_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`removed_cards_history_id\` PRIMARY KEY(\`id\`)
      )
    `);
  }

  console.log("Schema integrity check completed successfully.");
}

try {
  console.log("Running Drizzle migrations...");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed successfully");
} catch (error) {
  console.warn("Migration warning:", error.message);
} finally {
  try {
    await ensureSchemaIntegrity();
  } catch (error) {
    console.error("Schema integrity error:", error);
  }
  await pool.end();
}
