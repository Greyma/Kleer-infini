const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdminOrModerator } = require('../middleware/auth');
const { upload, uploadDocument, uploadToS3 } = require('../utils/upload');
const router = express.Router();

// Créer un profil entreprise (accepte les nouveaux champs + 3 fichiers)
router.post('/entreprise', [
  authenticateToken,
  body(['raison_sociale','nom_entreprise']).notEmpty().trim(),
  body(['numero_registre_commerce','siret']).notEmpty().trim(),
  body('wilaya').notEmpty().trim(),
  body('annees_experience').optional().isInt({ min: 0 }),
  body('specialites').optional(),
  body('contactName').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString(),
  // Legacy acceptance to keep backward compatibility
  body('adresse').optional().trim(),
  body('ville').optional().trim(),
  body('code_postal').optional().trim(),
  body('telephone').optional().isString(),
  body('email_contact').optional().isEmail().normalizeEmail(),
  body('type_activite').optional().trim(),
  body('description').optional().trim(),
  body('capacite_production').optional().isInt({ min: 1 }),
  body('certifications').optional().trim()
], upload.fields([{ name: 'registre' }, { name: 'attestation' }, { name: 'references' }]), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const nom_entreprise = req.body.nom_entreprise || req.body.raison_sociale;
    const siret = req.body.siret || req.body.numero_registre_commerce;
    const wilaya = req.body.wilaya;
    const annees_experience = req.body.annees_experience ?? null;
    const specialites = req.body.specialites ? (Array.isArray(req.body.specialites) ? req.body.specialites : (()=>{try{return JSON.parse(req.body.specialites);}catch{return null;}})()) : null;
    const contact_name = req.body.contactName || null;
    const email = req.body.email || req.body.email_contact || null;
    const phone = req.body.phone || req.body.telephone || null;
    const adresse = req.body.adresse || null;
    const ville = req.body.ville || null;
    const code_postal = req.body.code_postal || null;
    const type_activite = req.body.type_activite || null;
    const description = req.body.description || null;
    const capacite_production = req.body.capacite_production || null;
    const certifications = req.body.certifications || null;

    // Vérifier si l'entreprise existe déjà
    const [existingEntreprise] = await dbQuery(
      'SELECT id FROM entreprises WHERE siret = ?',
      [siret]
    );

    if (existingEntreprise) {
      return res.status(409).json({
        error: 'Entreprise déjà enregistrée',
        message: 'Une entreprise avec ce numéro SIRET existe déjà'
      });
    }

    // Handle 3 optional documents
    const files = req.files || {};
    let registreUrl = null, attestationUrl = null, referencesUrl = null;
    if (files.registre && files.registre[0]) {
      const f = await uploadToS3(files.registre[0], 'entreprises/registre');
      registreUrl = f.url;
    }
    if (files.attestation && files.attestation[0]) {
      const f = await uploadToS3(files.attestation[0], 'entreprises/attestation');
      attestationUrl = f.url;
    }
    if (files.references && files.references[0]) {
      const f = await uploadToS3(files.references[0], 'entreprises/references');
      referencesUrl = f.url;
    }

    // Insérer l'entreprise
    const result = await dbQuery(
      `INSERT INTO entreprises (
        user_id, nom_entreprise, siret, adresse, ville, code_postal,
        telephone, email_contact, type_activite, description,
        capacite_production, certifications, status, created_at,
        raison_sociale, wilaya, numero_registre_commerce, annees_experience, specialites,
        contact_name, logo_url, secteur, location, site,
        registre_url, attestation_url, references_url, owner_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
      [
        req.user.id,
        nom_entreprise,
        siret,
        adresse,
        ville,
        code_postal,
        phone,
        email,
        type_activite,
        description,
        capacite_production,
        certifications,
        nom_entreprise,
        wilaya,
        siret,
        annees_experience,
        specialites ? JSON.stringify(specialites) : null,
        contact_name,
        // logo_url NULL
        null,
        // secteur, location, site
        null,
        null,
        null,
        registreUrl,
        attestationUrl,
        referencesUrl,
        req.user.id
      ]
    );

    res.status(201).json({
      message: 'Profil entreprise créé avec succès',
      entreprise: {
        id: result.insertId,
        raison_sociale: nom_entreprise,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Erreur création entreprise:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la création du profil entreprise'
    });
  }
});

// Récupérer le profil entreprise de l'utilisateur connecté
router.get('/mon-entreprise', authenticateToken, async (req, res) => {
  try {
    const [entreprise] = await dbQuery(
      `SELECT * FROM entreprises WHERE user_id = ?`,
      [req.user.id]
    );

    if (!entreprise) {
      return res.status(404).json({
        error: 'Profil entreprise non trouvé',
        message: 'Aucun profil entreprise associé à votre compte'
      });
    }

    res.json({
      entreprise
    });

  } catch (error) {
    console.error('Erreur récupération entreprise:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération du profil entreprise'
    });
  }
});

// Mettre à jour le profil entreprise
router.put('/entreprise/:id', [
  body('nom_entreprise').optional().notEmpty().trim(),
  body('adresse').optional().notEmpty().trim(),
  body('ville').optional().notEmpty().trim(),
  body('code_postal').optional().isPostalCode('FR'),
  body('telephone').optional().isMobilePhone('fr-FR'),
  body('email_contact').optional().isEmail().normalizeEmail(),
  body('description').optional().trim(),
  body('capacite_production').optional().isInt({ min: 1 }),
  body('certifications').optional().trim()
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const entrepriseId = req.params.id;
    const updateFields = [];
    const updateValues = [];

    // Construire la requête de mise à jour
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(req.body[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Aucune donnée à mettre à jour',
        message: 'Veuillez fournir au moins un champ à modifier'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(entrepriseId, req.user.id);

    // Vérifier que l'entreprise appartient à l'utilisateur
    const [entreprise] = await dbQuery(
      'SELECT id FROM entreprises WHERE id = ? AND user_id = ?',
      [entrepriseId, req.user.id]
    );

    if (!entreprise) {
      return res.status(404).json({
        error: 'Entreprise non trouvée',
        message: 'Entreprise introuvable'
      });
    }

    await dbQuery(
      `UPDATE entreprises SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      updateValues
    );

    res.json({
      message: 'Profil entreprise mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour entreprise:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du profil entreprise'
    });
  }
});

// ADMIN: Lister toutes les entreprises
router.get('/admin/entreprises', requireAdminOrModerator, async (req, res) => {
  try {
    const { status, type_activite, region } = req.query;
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '1=1';
    let params = [];

    if (status) {
      whereClause += ' AND e.status = ?';
      params.push(status);
    }

    if (type_activite) {
      whereClause += ' AND e.type_activite LIKE ?';
      params.push(`%${type_activite}%`);
    }

    if (region) {
      whereClause += ' AND e.ville LIKE ?';
      params.push(`%${region}%`);
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM entreprises e WHERE ${whereClause}`,
      params
    );

    // Récupérer les entreprises
    const entreprises = await dbQuery(
      `SELECT e.*, u.nom, u.prenom, u.email
       FROM entreprises e
       JOIN users u ON e.user_id = u.id
       WHERE ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    const DEFAULT_IMAGE = '/images/default.jpg';
    const entreprisesMapped = entreprises.map(e => ({
      ...e,
      logo_url: e.logo_url || DEFAULT_IMAGE
    }));

    res.json({
      entreprises: entreprisesMapped,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limitNum)
      }
    });

  } catch (error) {
    console.error('Erreur récupération entreprises admin:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des entreprises'
    });
  }
});

// ADMIN: Modifier le statut d'une entreprise
router.put('/admin/entreprise/:id/status', [
  requireAdminOrModerator,
  body('status').isIn(['pending', 'approved', 'rejected']),
  body('commentaire').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const entrepriseId = req.params.id;
    const { status, commentaire } = req.body;

    // Vérifier que l'entreprise existe
    const [entreprise] = await dbQuery(
      'SELECT id FROM entreprises WHERE id = ?',
      [entrepriseId]
    );

    if (!entreprise) {
      return res.status(404).json({
        error: 'Entreprise non trouvée',
        message: 'Entreprise introuvable'
      });
    }

    // Mettre à jour le statut
    await dbQuery(
      'UPDATE entreprises SET status = ?, commentaire_admin = ?, updated_at = NOW() WHERE id = ?',
      [status, commentaire || null, entrepriseId]
    );

    res.json({
      message: 'Statut de l\'entreprise mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour statut entreprise:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

// Rechercher des entreprises par région/type
router.get('/recherche', async (req, res) => {
  try {
    const { region, type_activite, status = 'approved' } = req.query;

    let whereClause = 'e.status = ?';
    let params = [status];

    if (region) {
      whereClause += ' AND e.ville LIKE ?';
      params.push(`%${region}%`);
    }

    if (type_activite) {
      whereClause += ' AND e.type_activite LIKE ?';
      params.push(`%${type_activite}%`);
    }

    const entreprises = await dbQuery(
      `SELECT e.id, e.nom_entreprise, e.type_activite, e.ville, e.code_postal,
              e.description, e.capacite_production, e.certifications, e.created_at
       FROM entreprises e
       WHERE ${whereClause}
       ORDER BY e.created_at DESC`,
      params
    );

    res.json({
      entreprises
    });

  } catch (error) {
    console.error('Erreur recherche entreprises:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la recherche d\'entreprises'
    });
  }
});

module.exports = router; 
