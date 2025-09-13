const bcrypt = require('bcryptjs');
const { query, testConnection } = require('../config/database');

const seedData = async () => {
  try {
    console.log('🌱 Début du seeding de la base de données...');

    // Helper: upsert user and return id
    const upsertUser = async ({ email, passwordPlain, nom, prenom, role, status = 'active', telephone = null, profession = null, experience = null }) => {
      const password = await bcrypt.hash(passwordPlain, 12);
      await query(
        `INSERT INTO users (email, password, nom, prenom, telephone, profession, experience, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nom = VALUES(nom), prenom = VALUES(prenom), telephone = COALESCE(VALUES(telephone), telephone), profession = COALESCE(VALUES(profession), profession), experience = COALESCE(VALUES(experience), experience), role = VALUES(role), status = VALUES(status)`,
        [email, password, nom, prenom, telephone, profession, experience, role, status]
      );
      const rows = await query('SELECT id FROM users WHERE email = ?', [email]);
      return rows[0].id;
    };

    const adminId = await upsertUser({ email: 'admin@garoui-electricite.com', passwordPlain: 'admin123', nom: 'Admin', prenom: 'Garoui', role: 'admin' });
    const moderatorId = await upsertUser({ email: 'moderator@garoui-electricite.com', passwordPlain: 'moderator123', nom: 'Modérateur', prenom: 'Test', role: 'moderator' });
    const clientId = await upsertUser({ email: 'client@test.com', passwordPlain: 'client123', nom: 'Dupont', prenom: 'Jean', role: 'client' });
    const partenaireId = await upsertUser({ email: 'partenaire@test.com', passwordPlain: 'partenaire123', nom: 'Martin', prenom: 'Pierre', role: 'partner', telephone: '0600000000' });
    const candidatId = await upsertUser({ email: 'candidat@test.com', passwordPlain: 'candidat123', nom: 'Bernard', prenom: 'Marie', role: 'candidat', profession: 'Électricien', experience: 3 });
    console.log('✅ Utilisateurs (admin/moderator/client/partner/candidate) créés/à jour');

    // Créer des services
    const services = [
      {
        nom: 'Installation électrique résidentielle',
        description: 'Installation complète d\'un système électrique pour maison ou appartement',
        categorie: 'Installation',
        prix_base: 2500.00,
        duree_estimee: 3
      },
      {
        nom: 'Maintenance électrique industrielle',
        description: 'Maintenance préventive et curative des installations électriques industrielles',
        categorie: 'Maintenance',
        prix_base: 1500.00,
        duree_estimee: 2
      },
      {
        nom: 'Dépannage électrique urgent',
        description: 'Intervention rapide pour résoudre les problèmes électriques urgents',
        categorie: 'Dépannage',
        prix_base: 120.00,
        duree_estimee: 1
      },
      {
        nom: 'Mise aux normes électriques',
        description: 'Mise en conformité des installations électriques selon les normes en vigueur',
        categorie: 'Conformité',
        prix_base: 1800.00,
        duree_estimee: 4
      },
      {
        nom: 'Installation panneaux solaires',
        description: 'Installation et configuration de panneaux photovoltaïques',
        categorie: 'Énergies renouvelables',
        prix_base: 8000.00,
        duree_estimee: 5
      }
    ];

    for (const service of services) {
      await query(`
        INSERT INTO services (nom, description, categorie, prix_base, duree_estimee) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
      `, [service.nom, service.description, service.categorie, service.prix_base, service.duree_estimee]);
    }
    console.log('✅ Services créés');

    // Créer des produits
    const produits = [
      {
        nom: 'Interrupteur simple va-et-vient',
        description: 'Interrupteur électrique simple va-et-vient de qualité professionnelle',
        categorie: 'Interrupteurs',
        marque: 'Legrand',
        reference: 'LEG-INT-001',
        prix: 15.50,
        stock: 50
      },
      {
        nom: 'Prise de courant 16A',
        description: 'Prise de courant 16A avec terre, norme française',
        categorie: 'Prises',
        marque: 'Schneider',
        reference: 'SCH-PRI-001',
        prix: 8.90,
        stock: 100
      },
      {
        nom: 'Câble électrique 2.5mm²',
        description: 'Câble électrique rigide 2.5mm², 100m',
        categorie: 'Câbles',
        marque: 'Nexans',
        reference: 'NEX-CAB-001',
        prix: 45.00,
        stock: 25
      },
      {
        nom: 'Tableau électrique 12 modules',
        description: 'Tableau électrique avec 12 modules, coffret de protection',
        categorie: 'Tableaux',
        marque: 'Hager',
        reference: 'HAG-TAB-001',
        prix: 89.90,
        stock: 15
      },
      {
        nom: 'Disjoncteur différentiel 30mA',
        description: 'Disjoncteur différentiel 30mA, protection des personnes',
        categorie: 'Protection',
        marque: 'Schneider',
        reference: 'SCH-DIS-001',
        prix: 35.00,
        stock: 30
      }
    ];

    for (const produit of produits) {
      await query(`
        INSERT INTO produits (nom, description, categorie, marque, reference, prix, stock) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
      `, [produit.nom, produit.description, produit.categorie, produit.marque, produit.reference, produit.prix, produit.stock]);
    }
    console.log('✅ Produits créés');

    // Créer des partenaires
    const partenaires = [
      {
        nom: 'Électricité Pro Services',
        description: 'Entreprise spécialisée dans l\'installation électrique résidentielle et commerciale',
        categorie: 'Installation',
        site_web: 'https://www.electricite-pro-services.fr',
        email_contact: 'contact@electricite-pro-services.fr',
        telephone: '01 23 45 67 89'
      },
      {
        nom: 'Maintenance Électrique Plus',
        description: 'Service de maintenance électrique pour entreprises et industries',
        categorie: 'Maintenance',
        site_web: 'https://www.maintenance-electrique-plus.fr',
        email_contact: 'info@maintenance-electrique-plus.fr',
        telephone: '01 98 76 54 32'
      },
      {
        nom: 'Solaire Énergie Solutions',
        description: 'Installation et maintenance de panneaux solaires photovoltaïques',
        categorie: 'Énergies renouvelables',
        site_web: 'https://www.solaire-energie-solutions.fr',
        email_contact: 'contact@solaire-energie-solutions.fr',
        telephone: '01 45 67 89 12'
      }
    ];

    for (const partenaire of partenaires) {
      await query(`
        INSERT INTO partenaires (nom, description, categorie, site_web, email_contact, telephone) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
      `, [partenaire.nom, partenaire.description, partenaire.categorie, partenaire.site_web, partenaire.email_contact, partenaire.telephone]);
    }
    console.log('✅ Partenaires créés');

    // Entreprise (company) pour le partenaire
    const entreprisesRows = await query('SELECT id FROM entreprises WHERE user_id = ?', [partenaireId]);
    let entrepriseId;
    if (entreprisesRows.length) {
      entrepriseId = entreprisesRows[0].id;
    } else {
      const insertRes = await query(
        `INSERT INTO entreprises (user_id, nom_entreprise, siret, adresse, ville, code_postal, telephone, email_contact, type_activite, description, status, created_at, raison_sociale, wilaya, numero_registre_commerce, annees_experience, specialites)
         VALUES (?, 'Electricité Martin', '12345678901234', '1 rue de Paris', 'Paris', '75001', '0102030405', 'contact@martin.fr', 'Installation', 'Entreprise de test', 'approved', NOW(), 'Electricité Martin', 'Alger', 'RC-12345', 5, '["câblage","tableaux"]')`,
        [partenaireId]
      );
      entrepriseId = insertRes.insertId;
    }
    console.log('✅ Entreprise de test créée/présente');

    // Offres
    const offerInsert = await query(
      `INSERT INTO offres (user_id, company_id, titre, description, type, contract_type, experience_required, wilaya, salary_min, salary_max, currency, is_active, requirements, date_debut, date_fin, created_at)
       VALUES (?, ?, 'Électricien chantier', 'Installation et tirage de câbles', 'cdi', 'cdi', 2, 'Alger', 50000, 80000, 'DZD', 1, '["CACES","Habilitations électriques"]', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), NOW())`,
      [partenaireId, entrepriseId]
    );
    const offerId = offerInsert.insertId;
    console.log('✅ Offre de test créée');

    // Candidature à l'offre
    await query(
      `INSERT INTO offer_applications (offer_id, user_id, name, email, phone, status, applied_at)
       VALUES (?, ?, 'Marie Bernard', 'candidat@test.com', '0600112233', 'nouveau', NOW())`,
      [offerId, candidatId]
    );
    console.log('✅ Application à l\'offre créée');

    // Abonnement pour le candidat
    await query(
      `INSERT INTO subscriptions (user_id, type, plan, date_debut, date_fin, status)
       VALUES (?, 'mois', 'mensuel', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'active')`,
      [candidatId]
    );
    console.log('✅ Abonnement de test créé');

    // Créer quelques candidatures de test
    const candidatures = [
      {
        user_id: candidatId,
        poste: 'Électricien installateur',
        experience: 3,
        formation: 'BTS Électrotechnique',
        motivation: 'Passionné par l\'électricité, je souhaite rejoindre une équipe dynamique',
        disponibilite: '2024-02-01',
        salaire_souhaite: 2200.00
      },
      {
        user_id: candidatId,
        poste: 'Technicien de maintenance',
        experience: 5,
        formation: 'DUT Génie électrique',
        motivation: 'Expérience en maintenance industrielle, recherche de nouveaux défis',
        disponibilite: '2024-01-15',
        salaire_souhaite: 2500.00
      }
    ];

    for (const candidature of candidatures) {
      await query(`
        INSERT INTO candidatures (user_id, poste, experience, formation, motivation, disponibilite, salaire_souhaite) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
      `, [candidature.user_id, candidature.poste, candidature.experience, candidature.formation, candidature.motivation, candidature.disponibilite, candidature.salaire_souhaite]);
    }
    console.log('✅ Candidatures créées');

    // Créer quelques devis de test
    const devis = [
      {
        client_id: 3, // client@test.com
        date_souhaitee: '2024-02-15',
        adresse_intervention: '123 Rue de la Paix, 75001 Paris',
        description_besoin: 'Installation électrique complète pour appartement neuf',
        urgence: 'normale',
        montant_total: 2500.00
      },
      {
        client_id: 3,
        date_souhaitee: '2024-01-20',
        adresse_intervention: '456 Avenue des Champs, 69000 Lyon',
        description_besoin: 'Dépannage électrique urgent - panne de courant',
        urgence: 'urgente',
        montant_total: 120.00
      }
    ];

    for (const devisItem of devis) {
      await query(`
        INSERT INTO devis (client_id, date_souhaitee, adresse_intervention, description_besoin, urgence, montant_total) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id
      `, [devisItem.client_id, devisItem.date_souhaitee, devisItem.adresse_intervention, devisItem.description_besoin, devisItem.urgence, devisItem.montant_total]);
    }
    console.log('✅ Devis créés');

    console.log('🎉 Seeding terminé avec succès !');
    console.log('\n📋 Comptes de test créés :');
    console.log('Admin: admin@garoui-electricite.com / admin123');
    console.log('Modérateur: moderator@garoui-electricite.com / moderator123');
    console.log('Client: client@test.com / client123');
    console.log('Partenaire: partenaire@test.com / partenaire123');
    console.log('Candidat: candidat@test.com / candidat123');

  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  }
};

// Exécuter le seeding
const runSeeding = async () => {
  try {
    await testConnection();
    await seedData();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  }
};

runSeeding(); 
