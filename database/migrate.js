const { runMigrations, getDbPool } = require('../config/database');

async function main() {
  console.log('🔄 Running database schema migration & initial seed...');
  try {
    await runMigrations();
    console.log('✅ Database migration and seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
