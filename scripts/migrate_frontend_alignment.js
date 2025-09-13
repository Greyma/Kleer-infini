// Align database schema with frontend expectations
// Run this once with a DB connection: require('./config/database').query

module.exports = async function migrate(db) {
  // Helper to add column if missing
  async function addColumnIfMissing(table, columnDef) {
    const rows = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, columnDef.name]
    );
    if (!rows || rows.length === 0) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef.sql}`);
    }
  }

  // Helper to add index if missing
  async function addIndexIfMissing(table, indexName, sql) {
    const rows = await db.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName]
    );
    if (!rows || rows.length === 0) {
      await db.query(sql);
    }
  }

  // Ensure base tables exist (safe no-op if already there)
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nom VARCHAR(100) NOT NULL,
      prenom VARCHAR(100) NOT NULL,
      telephone VARCHAR(20),
      role ENUM('client', 'partner', 'candidat', 'moderator', 'admin') DEFAULT 'client',
      status ENUM('pending', 'active', 'inactive') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS entreprises (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      nom_entreprise VARCHAR(200) NOT NULL,
      siret VARCHAR(14) UNIQUE NOT NULL,
      adresse TEXT NOT NULL,
      ville VARCHAR(100) NOT NULL,
      code_postal VARCHAR(10) NOT NULL,
      telephone VARCHAR(20) NOT NULL,
      email_contact VARCHAR(255) NOT NULL,
      type_activite VARCHAR(100) NOT NULL,
      description TEXT,
      capacite_production INT,
      certifications TEXT,
      document_url VARCHAR(500),
      document_key VARCHAR(255),
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      commentaire_admin TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      categorie VARCHAR(100) NOT NULL,
      prix_base DECIMAL(10,2) NOT NULL,
      duree_estimee INT,
      disponibilite BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS devis (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      date_souhaitee DATE NOT NULL,
      adresse_intervention TEXT NOT NULL,
      description_besoin TEXT,
      urgence ENUM('normale', 'urgente', 'tres_urgente') DEFAULT 'normale',
      montant_total DECIMAL(10,2) NOT NULL,
      prix_final DECIMAL(10,2),
      status ENUM('en_attente', 'en_cours', 'accepte', 'refuse', 'termine') DEFAULT 'en_attente',
      commentaire_admin TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS devis_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      devis_id INT NOT NULL,
      service_id INT NOT NULL,
      quantite INT NOT NULL,
      prix_unitaire DECIMAL(10,2) NOT NULL,
      montant DECIMAL(10,2) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS produits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      categorie VARCHAR(100) NOT NULL,
      marque VARCHAR(100) NOT NULL,
      reference VARCHAR(100) NOT NULL,
      prix DECIMAL(10,2) NOT NULL,
      stock INT DEFAULT 0,
      specifications TEXT,
      image_url VARCHAR(500),
      image_key VARCHAR(255),
      disponibilite BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS partenaires (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      categorie VARCHAR(100) NOT NULL,
      site_web VARCHAR(255),
      email_contact VARCHAR(255),
      telephone VARCHAR(20),
      adresse TEXT,
      ville VARCHAR(100),
      code_postal VARCHAR(10),
      logo_url VARCHAR(500),
      logo_key VARCHAR(255),
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS partenaire_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partenaire_id INT NOT NULL,
      service_id INT NOT NULL,
      UNIQUE KEY unique_partenaire_service (partenaire_id, service_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS candidatures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      poste VARCHAR(100) NOT NULL,
      experience INT NOT NULL,
      formation TEXT NOT NULL,
      motivation TEXT NOT NULL,
      disponibilite DATE NOT NULL,
      salaire_souhaite DECIMAL(10,2),
      cv_url VARCHAR(500),
      cv_key VARCHAR(255),
      status ENUM('pending', 'reviewed', 'accepted', 'rejected') DEFAULT 'pending',
      commentaire_admin TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS diplomes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      candidature_id INT NOT NULL,
      nom_diplome VARCHAR(200) NOT NULL,
      etablissement VARCHAR(200) NOT NULL,
      annee_obtention INT NOT NULL,
      document_url VARCHAR(500),
      document_key VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // users: add profession, experience; ensure unique email index
  await addColumnIfMissing('users', { name: 'profession', sql: 'profession VARCHAR(255) NULL' });
  await addColumnIfMissing('users', { name: 'experience', sql: 'experience INT NULL' });
  await addIndexIfMissing('users', 'ux_users_email', 'CREATE UNIQUE INDEX ux_users_email ON users (email)');

  // Ensure core tables exist (offres, subscriptions)
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // subscriptions: add plan and canceled_at
  await addColumnIfMissing('subscriptions', { name: 'plan', sql: "plan ENUM('mensuel','trimestriel') NULL" });
  await addColumnIfMissing('subscriptions', { name: 'canceled_at', sql: 'canceled_at DATETIME NULL' });

  // entreprises (companies): add frontend-aligned fields without removing legacy ones
  await addColumnIfMissing('entreprises', { name: 'raison_sociale', sql: 'raison_sociale VARCHAR(255) NULL' });
  await addColumnIfMissing('entreprises', { name: 'wilaya', sql: 'wilaya VARCHAR(100) NULL' });
  await addColumnIfMissing('entreprises', { name: 'numero_registre_commerce', sql: 'numero_registre_commerce VARCHAR(100) NULL' });
  await addColumnIfMissing('entreprises', { name: 'annees_experience', sql: 'annees_experience INT NULL' });
  await addColumnIfMissing('entreprises', { name: 'specialites', sql: 'specialites TEXT NULL' });
  await addColumnIfMissing('entreprises', { name: 'contact_name', sql: 'contact_name VARCHAR(255) NULL' });
  await addColumnIfMissing('entreprises', { name: 'logo_url', sql: 'logo_url VARCHAR(500) NULL' });
  await addColumnIfMissing('entreprises', { name: 'secteur', sql: 'secteur VARCHAR(255) NULL' });
  await addColumnIfMissing('entreprises', { name: 'location', sql: 'location VARCHAR(255) NULL' });
  await addColumnIfMissing('entreprises', { name: 'site', sql: 'site VARCHAR(255) NULL' });
  await addColumnIfMissing('entreprises', { name: 'registre_url', sql: 'registre_url VARCHAR(500) NULL' });
  await addColumnIfMissing('entreprises', { name: 'attestation_url', sql: 'attestation_url VARCHAR(500) NULL' });
  await addColumnIfMissing('entreprises', { name: 'references_url', sql: 'references_url VARCHAR(500) NULL' });
  await addColumnIfMissing('entreprises', { name: 'owner_user_id', sql: 'owner_user_id INT NULL' });
  await addIndexIfMissing('entreprises', 'ux_entreprises_rc', 'CREATE UNIQUE INDEX ux_entreprises_rc ON entreprises (numero_registre_commerce)');
  // Relax some legacy NOT NULLs to support minimal payloads
  try { await db.query("ALTER TABLE entreprises MODIFY COLUMN adresse TEXT NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE entreprises MODIFY COLUMN ville VARCHAR(100) NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE entreprises MODIFY COLUMN code_postal VARCHAR(10) NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE entreprises MODIFY COLUMN telephone VARCHAR(20) NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE entreprises MODIFY COLUMN email_contact VARCHAR(255) NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE entreprises MODIFY COLUMN type_activite VARCHAR(100) NULL"); } catch (e) {}

  // offres (offers): add fields required by frontend
  await addColumnIfMissing('offres', { name: 'company_id', sql: 'company_id INT NULL' });
  await addColumnIfMissing('offres', { name: 'contract_type', sql: "contract_type ENUM('cdi','cdd','stage','apprentissage','projet') NOT NULL DEFAULT 'projet'" });
  await addColumnIfMissing('offres', { name: 'experience_required', sql: 'experience_required INT NOT NULL DEFAULT 0' });
  await addColumnIfMissing('offres', { name: 'wilaya', sql: 'wilaya VARCHAR(100) NULL' });
  await addColumnIfMissing('offres', { name: 'salary_min', sql: 'salary_min DECIMAL(10,2) NULL' });
  await addColumnIfMissing('offres', { name: 'salary_max', sql: 'salary_max DECIMAL(10,2) NULL' });
  await addColumnIfMissing('offres', { name: 'currency', sql: "currency VARCHAR(10) NOT NULL DEFAULT 'DZD'" });
  await addColumnIfMissing('offres', { name: 'is_active', sql: 'is_active TINYINT(1) NOT NULL DEFAULT 1' });
  await addColumnIfMissing('offres', { name: 'requirements', sql: 'requirements TEXT NULL' });
  await addIndexIfMissing('offres', 'ix_offres_company', 'CREATE INDEX ix_offres_company ON offres (company_id)');
  await addIndexIfMissing('offres', 'ix_offres_active', 'CREATE INDEX ix_offres_active ON offres (is_active)');
  await addIndexIfMissing('offres', 'ix_offres_wilaya', 'CREATE INDEX ix_offres_wilaya ON offres (wilaya)');
  await addIndexIfMissing('offres', 'ix_offres_contract', 'CREATE INDEX ix_offres_contract ON offres (contract_type)');
  // Relax legacy NOT NULLs to allow new DTO
  try { await db.query("ALTER TABLE offres MODIFY COLUMN type VARCHAR(100) NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE offres MODIFY COLUMN date_debut DATE NULL"); } catch (e) {}
  try { await db.query("ALTER TABLE offres MODIFY COLUMN date_fin DATE NULL"); } catch (e) {}

  // offer_applications: create table if missing
  await db.query(`
    CREATE TABLE IF NOT EXISTS offer_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      offer_id INT NOT NULL,
      user_id INT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      cv_url VARCHAR(500) NULL,
      cover_letter_url VARCHAR(500) NULL,
      status ENUM('nouveau','en_cours','accepte','refuse') NOT NULL DEFAULT 'nouveau',
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX ix_offer_app_offer (offer_id),
      INDEX ix_offer_app_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // candidatures (candidate_application): optional fields for non-auth flow and photos
  await addColumnIfMissing('candidatures', { name: 'first_name', sql: 'first_name VARCHAR(100) NULL' });
  await addColumnIfMissing('candidatures', { name: 'last_name', sql: 'last_name VARCHAR(100) NULL' });
  await addColumnIfMissing('candidatures', { name: 'email', sql: 'email VARCHAR(255) NULL' });
  await addColumnIfMissing('candidatures', { name: 'phone', sql: 'phone VARCHAR(50) NULL' });
  await addColumnIfMissing('candidatures', { name: 'photos_urls', sql: 'photos_urls TEXT NULL' });

  // services: add icon
  await addColumnIfMissing('services', { name: 'icon', sql: 'icon VARCHAR(100) NULL' });

  // devis (quote_request): add timeline and budget
  await addColumnIfMissing('devis', { name: 'timeline', sql: 'timeline VARCHAR(50) NULL' });
  await addColumnIfMissing('devis', { name: 'budget', sql: 'budget VARCHAR(100) NULL' });

  // produits (products): add voltage and is_active
  await addColumnIfMissing('produits', { name: 'voltage', sql: 'voltage VARCHAR(50) NULL' });
  await addColumnIfMissing('produits', { name: 'is_active', sql: 'is_active TINYINT(1) NOT NULL DEFAULT 1' });

  // payments table
  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      plan_id VARCHAR(50) NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','completed','failed') NOT NULL,
      payment_method ENUM('card','bank_transfer','mobile_money','chargily') NOT NULL,
      transaction_id VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX ix_payments_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};
