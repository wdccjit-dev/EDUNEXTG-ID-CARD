import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function cleanAllTestData() {
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  console.log("Cleaning test & mock data...");
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0;`);

  // 1. Delete all test orders
  await db.execute(sql`DELETE FROM orders;`);
  console.log("Cleared orders");

  // 2. Delete test card records & history
  await db.execute(sql`DELETE FROM removed_cards_history;`);
  await db.execute(sql`DELETE FROM approval_history;`);
  await db.execute(sql`DELETE FROM id_card_files;`);
  await db.execute(sql`DELETE FROM id_card_data;`);
  await db.execute(sql`DELETE FROM id_cards;`);
  await db.execute(sql`DELETE FROM idCardRequests;`);
  console.log("Cleared id_cards, id_card_data, id_card_files, and requests");

  // 3. Delete template elements & school templates for non-primary templates
  await db.execute(sql`DELETE FROM template_elements WHERE template_id != 1;`);
  await db.execute(sql`DELETE FROM school_templates WHERE school_id != 1 OR template_id != 1;`);
  await db.execute(sql`DELETE FROM idCardTemplates WHERE id != 1;`);
  console.log("Cleared test templates");

  // 4. Delete notifications, audit logs, and password resets
  await db.execute(sql`DELETE FROM password_resets;`);
  await db.execute(sql`DELETE FROM audit_logs;`);
  await db.execute(sql`DELETE FROM notifications;`);
  console.log("Cleared notifications, audit logs, & password resets");

  // 5. Delete test users (keep primary administrator #1 and school admin #2)
  await db.execute(sql`DELETE FROM users WHERE id NOT IN (1, 2);`);
  console.log("Cleared test users");

  // 6. Delete test schools (keep primary school #1)
  await db.execute(sql`DELETE FROM schools WHERE id != 1;`);
  console.log("Cleared test schools (kept primary school #1)");

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1;`);

  console.log("All test & mock data cleaned successfully!");
  process.exit(0);
}

cleanAllTestData().catch((err) => {
  console.error("Failed to clean test data:", err);
  process.exit(1);
});
