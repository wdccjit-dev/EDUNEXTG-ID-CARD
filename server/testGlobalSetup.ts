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
      DELETE FROM removed_cards_history 
      WHERE school_id IN (
        SELECT id FROM schools WHERE email LIKE '%@test.local' OR shortCode LIKE 'ST%' OR shortCode LIKE 'SCA%' OR shortCode LIKE 'SCB%' OR shortCode LIKE 'UA%' OR shortCode LIKE 'UB%' OR name LIKE '%Test%'
      ) OR removed_by_user_id IN (
        SELECT id FROM users WHERE email LIKE '%@test.local' OR openId LIKE '%test%' OR openId LIKE '%mkt%'
      )
    `).catch(() => {});

    await conn.execute(`
      DELETE FROM orders 
      WHERE school_id IN (
        SELECT id FROM schools WHERE email LIKE '%@test.local' OR shortCode LIKE 'ST%' OR shortCode LIKE 'SCA%' OR shortCode LIKE 'SCB%' OR shortCode LIKE 'UA%' OR shortCode LIKE 'UB%' OR name LIKE '%Test%'
      ) OR placed_by_user_id IN (
        SELECT id FROM users WHERE email LIKE '%@test.local' OR openId LIKE '%test%' OR openId LIKE '%mkt%'
      )
    `).catch(() => {});

    await conn.execute(`
      DELETE FROM idCardData WHERE idCardId IN (
        SELECT id FROM idCards WHERE schoolId IN (
          SELECT id FROM schools WHERE email LIKE '%@test.local' OR shortCode LIKE 'ST%' OR shortCode LIKE 'SCA%' OR shortCode LIKE 'SCB%' OR shortCode LIKE 'UA%' OR shortCode LIKE 'UB%' OR name LIKE '%Test%'
        )
      )
    `).catch(() => {});

    await conn.execute(`
      DELETE FROM idCards WHERE schoolId IN (
        SELECT id FROM schools WHERE email LIKE '%@test.local' OR shortCode LIKE 'ST%' OR shortCode LIKE 'SCA%' OR shortCode LIKE 'SCB%' OR shortCode LIKE 'UA%' OR shortCode LIKE 'UB%' OR name LIKE '%Test%'
      )
    `).catch(() => {});

    await conn.execute(`
      DELETE FROM idCardRequests WHERE schoolId IN (
        SELECT id FROM schools WHERE email LIKE '%@test.local' OR shortCode LIKE 'ST%' OR shortCode LIKE 'SCA%' OR shortCode LIKE 'SCB%' OR shortCode LIKE 'UA%' OR shortCode LIKE 'UB%' OR name LIKE '%Test%'
      )
    `).catch(() => {});

    await conn.execute(`
      DELETE FROM schoolTemplates WHERE schoolId IN (
        SELECT id FROM schools WHERE email LIKE '%@test.local' OR shortCode LIKE 'ST%' OR shortCode LIKE 'SCA%' OR shortCode LIKE 'SCB%' OR shortCode LIKE 'UA%' OR shortCode LIKE 'UB%' OR name LIKE '%Test%'
      )
    `).catch(() => {});

    await conn.execute(`
      DELETE FROM schools 
      WHERE email LIKE '%@test.local' 
         OR shortCode LIKE 'ST%' 
         OR shortCode LIKE 'SCA%' 
         OR shortCode LIKE 'SCB%' 
         OR shortCode LIKE 'UA%' 
         OR shortCode LIKE 'UB%' 
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
