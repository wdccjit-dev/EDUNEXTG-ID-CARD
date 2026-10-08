import "dotenv/config";
import mysql from "mysql2/promise";

async function purgeTestArtifacts() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  let conn;
  try {
    conn = await mysql.createConnection(databaseUrl);
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0;");

    // 1. Delete all test orders
    await conn.execute("DELETE FROM orders;");

    // 2. Delete test card records & history
    await conn.execute("DELETE FROM removed_cards_history;");
    await conn.execute("DELETE FROM approval_history;");
    await conn.execute("DELETE FROM id_card_files;");
    await conn.execute("DELETE FROM id_card_data;");
    await conn.execute("DELETE FROM id_cards;");
    await conn.execute("DELETE FROM idCardRequests;");

    // 3. Delete test template elements & templates
    await conn.execute("DELETE FROM template_elements WHERE template_id != 1;");
    await conn.execute("DELETE FROM school_templates WHERE school_id != 1 OR template_id != 1;");
    await conn.execute("DELETE FROM idCardTemplates WHERE id != 1;");

    // 4. Delete password resets, audit logs, and notifications
    await conn.execute("DELETE FROM password_resets;");
    await conn.execute("DELETE FROM audit_logs;");
    await conn.execute("DELETE FROM notifications;");

    // 5. Delete test users (keep primary administrator #1 and school admin #2)
    await conn.execute("DELETE FROM users WHERE id NOT IN (1, 2);");

    // 6. Delete test schools (keep primary school #1)
    await conn.execute("DELETE FROM schools WHERE id != 1;");

    await conn.execute("SET FOREIGN_KEY_CHECKS = 1;");
  } catch (err) {
    console.warn("[Test cleanup] Could not purge test artifacts:", err);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

export async function setup() {
  await purgeTestArtifacts();
}

export async function teardown() {
  await purgeTestArtifacts();
}
