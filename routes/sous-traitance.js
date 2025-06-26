const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdminOrModerator } = require('../middleware/auth');
const { uploadDocument, uploadToS3 } = require('../utils/upload');
const router = express.Router();

// Créer un profil entreprise
router.post('/entreprise', [
  body('nom_entreprise').notEmpty().trim(),
  body('siret').isLength({ min: 14, max: 14 }),
  body('adresse').notEmpty().trim(),
  body('ville').notEmpty().trim(),
  body('code_postal').isPostalCode('FR'),
  body('telephone').isMobilePhone('fr-FR'),
  body('email_contact').isEmail().normalizeEmail(),
  body('type_activite').notEmpty().trim(),
  body('description').optional().trim(),
  body('capacite_production').optional().isInt({ min: 1 }),
  body('certifications').optional().trim()
], uploadDocument, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const {
      nom_entreprise,
      siret,
      adresse,
      ville,
      code_postal,
      telephone,
      email_contact,
      type_activite,
      description,
      capacite_production,
      certifications
    } = req.body;

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

    let documentUrl = null;
    let documentKey = null;

    if (req.file) {
      const documentFile = await uploadToS3(req.file, 'entreprises');
      documentUrl = documentFile.url;
      documentKey = documentFile.key;
    }

    // Insérer l'entreprise
    const [result] = await dbQuery(
      `INSERT INTO entreprises (
        user_id, nom_entreprise, siret, adresse, ville, code_postal,
        telephone, email_contact, type_activite, description,
        capacite_production, certifications, document_url, document_key,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        req.user.id,
        nom_entreprise,
        siret,
        adresse,
        ville,
        code_postal,
        telephone,
        email_contact,
        type_activite,
        description || null,
        capacite_production || null,
        certifications || null,
        documentUrl,
        documentKey
      ]
    );

    res.status(201).json({
      message: 'Profil entreprise créé avec succès',
      entreprise: {
        id: result.insertId,
        nom_entreprise,
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
    const { status, type_activite, region, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

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
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      entreprises,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
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