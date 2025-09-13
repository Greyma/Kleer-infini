const { testConnection } = require('../config/database');

(async () => {
  try {
    await testConnection();
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
})();

