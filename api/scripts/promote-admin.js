const mysql = require('mysql2/promise');
const config = require('../src/config');

async function run() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run admin:promote -- admin@kiit.ac.in');
  if (!config.databaseConfigured) throw new Error('Database configuration is required to promote an admin.');

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name
  });

  try {
    const [result] = await connection.execute('UPDATE students SET is_admin = TRUE WHERE email = ?', [email]);
    if (result.affectedRows !== 1) throw new Error(`No student account found for ${email}.`);
    console.log(`Admin access enabled for ${email}.`);
  } finally {
    await connection.end();
  }
}

run().catch(error => {
  console.error(`[PathfolioApp] Unable to promote admin: ${error.message}`);
  process.exitCode = 1;
});