// Migration SQL pour la table subscriptions
module.exports = async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('mois','trimestre') NOT NULL,
      date_debut DATETIME NOT NULL,
      date_fin DATETIME NOT NULL,
      status ENUM('active','cancelled','expired') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
};
