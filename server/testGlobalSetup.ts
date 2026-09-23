import mysql from "mysql2/promise";

async function purgeTestArtifacts() {
  try {
    const conn = await mysql.createConnection("mysql://root:asHik@8967@127.0.0.1:3306/school_id_card_management");

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
    // Ignore cleanup error
  }
}

export async function setup() {
  await purgeTestArtifacts();
}

export async function teardown() {
  await purgeTestArtifacts();
}
