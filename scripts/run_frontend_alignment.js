const { query, testConnection } = require('../config/database');

(async () => {
  try {
    console.log('🔄 Lancement migration d\'alignement frontend...');
    await testConnection();
    const migrate = require('./migrate_frontend_alignment');
    await migrate({
      query: async (sql, params = []) => query(sql, params)
    });
    console.log('✅ Migration d\'alignement terminée');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration d\'alignement:', err);
    process.exit(1);
  }
})();

