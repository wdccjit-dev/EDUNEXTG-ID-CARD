import "dotenv/config";
import mysql from "mysql2/promise";

async function purgeTestArtifacts() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to clean up database test artifacts");
  }

  try {
    const conn = await mysql.createConnection(databaseUrl);

    await conn.execute(`
      DELETE FROM password_resets 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%@test.local' 
           OR openId LIKE '%test%' 
           OR openId LIKE '%sec_admin%' 
           OR openId LIKE '%school_a%' 
           OR openId LIKE '%school_b%' 
           OR openId LIKE '%operator_a%' 
           OR openId LIKE '%viewer_a%'
      )
    `);

    await conn.execute(`
      DELETE FROM audit_logs 
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE email LIKE '%@test.local' 
           OR openId LIKE '%test%' 
           OR openId LIKE '%sec_admin%' 
           OR openId LIKE '%school_a%' 
           OR openId LIKE '%school_b%' 
           OR openId LIKE '%operator_a%' 
           OR openId LIKE '%viewer_a%'
      )
    `);

    await conn.execute(`
      DELETE FROM users 
      WHERE email LIKE '%@test.local' 
         OR openId LIKE '%test%' 
         OR openId LIKE '%sec_admin%' 
         OR openId LIKE '%school_a%' 
         OR openId LIKE '%school_b%' 
         OR openId LIKE '%operator_a%' 
         OR openId LIKE '%viewer_a%'
    `);

    await conn.execute(`
      DELETE FROM notifications 
      WHERE message LIKE '%test%' OR title LIKE '%test%' OR title LIKE '%Test%'
    `);

    await conn.execute(`
      DELETE FROM schools 
      WHERE email LIKE '%@test.local' 
         OR shortCode LIKE 'ST%' 
         OR shortCode LIKE 'SCA%' 
         OR shortCode LIKE 'SCB%' 
         OR name LIKE '%Test%'
    `);

    await conn.end();
  } catch (err) {
    console.warn("[Test cleanup] Could not purge test artifacts:", err);
  }
}

export async function setup() {
  await purgeTestArtifacts();
}

export async function teardown() {
  await purgeTestArtifacts();
}
