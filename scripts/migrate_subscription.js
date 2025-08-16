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
      raison_sociale VARCHAR(255) NOT NULL,
      wilaya VARCHAR(100) NOT NULL,
      numero_registre_commerce VARCHAR(100) NOT NULL,
      annees_experience INT NOT NULL,
      specialites TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
};
