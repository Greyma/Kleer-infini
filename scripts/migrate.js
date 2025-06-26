const { query, testConnection } = require('../config/database');

const createTables = async () => {
  try {
    console.log('🔄 Début de la migration de la base de données...');

    // Table users
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table users créée');

    // Table candidatures
    await query(`
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table candidatures créée');

    // Table diplomes
    await query(`
      CREATE TABLE IF NOT EXISTS diplomes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidature_id INT NOT NULL,
        nom_diplome VARCHAR(200) NOT NULL,
        etablissement VARCHAR(200) NOT NULL,
        annee_obtention INT NOT NULL,
        document_url VARCHAR(500),
        document_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (candidature_id) REFERENCES candidatures(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table diplomes créée');

    // Table entreprises
    await query(`
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table entreprises créée');

    // Table services
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table services créée');

    // Table devis
    await query(`
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table devis créée');

    // Table devis_services
    await query(`
      CREATE TABLE IF NOT EXISTS devis_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        devis_id INT NOT NULL,
        service_id INT NOT NULL,
        quantite INT NOT NULL,
        prix_unitaire DECIMAL(10,2) NOT NULL,
        montant DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table devis_services créée');

    // Table produits
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table produits créée');

    // Table partenaires
    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table partenaires créée');

    // Table partenaire_services
    await query(`
      CREATE TABLE IF NOT EXISTS partenaire_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        partenaire_id INT NOT NULL,
        service_id INT NOT NULL,
        FOREIGN KEY (partenaire_id) REFERENCES partenaires(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE KEY unique_partenaire_service (partenaire_id, service_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table partenaire_services créée');

    console.log('🎉 Migration terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
};

// Exécuter la migration
const runMigration = async () => {
  try {
    await testConnection();
    await createTables();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
};

runMigration(); 