const { initDatabase, getStatus } = require('./db');

(async () => {
  console.log('Initializing database schema and seed data...');
  const status = await initDatabase();
  console.log('Database Status:', status);
  process.exit(0);
})();
