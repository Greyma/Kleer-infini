// Migration SQL pour la table offres
module.exports = async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS offres (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      titre VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      type VARCHAR(100) NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
};
