const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdminOrModerator } = require('../middleware/auth');
const { uploadDocument, uploadToS3 } = require('../utils/upload');
const router = express.Router();

// Créer un nouveau partenaire
router.post('/partenaires', [
  requireAdminOrModerator,
  body('nom').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('categorie').notEmpty().trim(),
  body('site_web').optional().isURL(),
  body('email_contact').optional().isEmail().normalizeEmail(),
  body('telephone').optional().isMobilePhone('fr-FR'),
  body('adresse').optional().trim(),
  body('ville').optional().trim(),
  body('code_postal').optional().isPostalCode('FR')
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
      nom,
      description,
      categorie,
      site_web,
      email_contact,
      telephone,
      adresse,
      ville,
      code_postal
    } = req.body;

    let logoUrl = null;
    let logoKey = null;

    if (req.file) {
      const logoFile = await uploadToS3(req.file, 'partenaires');
      logoUrl = logoFile.url;
      logoKey = logoFile.key;
    }

    const [result] = await dbQuery(
      `INSERT INTO partenaires (
        nom, description, categorie, site_web, email_contact,
        telephone, adresse, ville, code_postal, logo_url, logo_key,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [nom, description, categorie, site_web || null, email_contact || null, telephone || null, adresse || null, ville || null, code_postal || null, logoUrl, logoKey]
    );

    res.status(201).json({
      message: 'Partenaire créé avec succès',
      partenaire: {
        id: result.insertId,
        nom,
        categorie
      }
    });

  } catch (error) {
    console.error('Erreur création partenaire:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la création du partenaire'
    });
  }
});

// Lister tous les partenaires
router.get('/partenaires', async (req, res) => {
  try {
    const { categorie, status = 'active' } = req.query;
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'status = ?';
    let params = [status];

    if (categorie) {
      whereClause += ' AND categorie = ?';
      params.push(categorie);
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM partenaires WHERE ${whereClause}`,
      params
    );

    // Récupérer les partenaires
    const partenaires = await dbQuery(
      `SELECT * FROM partenaires WHERE ${whereClause} ORDER BY nom LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    const partenairesMapped = partenaires.map(p => ({
      ...p,
      logo_url: p.logo_url
    }));

    res.json({
      partenaires: partenairesMapped,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limitNum)
      }
    });

  } catch (error) {
    console.error('Erreur récupération partenaires:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des partenaires'
    });
  }
});

// Récupérer un partenaire spécifique
router.get('/partenaires/:id', async (req, res) => {
  try {
    const partenaireId = req.params.id;

    const [partenaire] = await dbQuery(
      'SELECT * FROM partenaires WHERE id = ?',
      [partenaireId]
    );

    if (!partenaire) {
      return res.status(404).json({
        error: 'Partenaire non trouvé',
        message: 'Partenaire introuvable'
      });
    }

    res.json({
      partenaire: { ...partenaire, logo_url: partenaire.logo_url }
    });

  } catch (error) {
    console.error('Erreur récupération partenaire:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération du partenaire'
    });
  }
});

// Mettre à jour un partenaire
router.put('/partenaires/:id', [
  requireAdminOrModerator,
  body('nom').optional().notEmpty().trim(),
  body('description').optional().notEmpty().trim(),
  body('categorie').optional().notEmpty().trim(),
  body('site_web').optional().isURL(),
  body('email_contact').optional().isEmail().normalizeEmail(),
  body('telephone').optional().isMobilePhone('fr-FR'),
  body('adresse').optional().trim(),
  body('ville').optional().trim(),
  body('code_postal').optional().isPostalCode('FR'),
  body('status').optional().isIn(['active', 'inactive'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const partenaireId = req.params.id;
    const updateFields = [];
    const updateValues = [];

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
    updateValues.push(partenaireId);

    // Vérifier que le partenaire existe
    const [partenaire] = await dbQuery(
      'SELECT id FROM partenaires WHERE id = ?',
      [partenaireId]
    );

    if (!partenaire) {
      return res.status(404).json({
        error: 'Partenaire non trouvé',
        message: 'Partenaire introuvable'
      });
    }

    await dbQuery(
      `UPDATE partenaires SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      message: 'Partenaire mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour partenaire:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du partenaire'
    });
  }
});

// Supprimer un partenaire
router.delete('/partenaires/:id', requireAdminOrModerator, async (req, res) => {
  try {
    const partenaireId = req.params.id;

    // Vérifier que le partenaire existe
    const [partenaire] = await dbQuery(
      'SELECT id FROM partenaires WHERE id = ?',
      [partenaireId]
    );

    if (!partenaire) {
      return res.status(404).json({
        error: 'Partenaire non trouvé',
        message: 'Partenaire introuvable'
      });
    }

    await dbQuery('DELETE FROM partenaires WHERE id = ?', [partenaireId]);

    res.json({
      message: 'Partenaire supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression partenaire:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la suppression du partenaire'
    });
  }
});

// Récupérer les catégories de partenaires
router.get('/categories', async (req, res) => {
  try {
    const categories = await dbQuery(
      'SELECT DISTINCT categorie, COUNT(*) as nombre_partenaires FROM partenaires WHERE status = "active" GROUP BY categorie ORDER BY categorie'
    );

    res.json({
      categories
    });

  } catch (error) {
    console.error('Erreur récupération catégories partenaires:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des catégories'
    });
  }
});

// Associer un partenaire à des services
router.post('/partenaires/:id/services', [
  requireAdminOrModerator,
  body('services').isArray({ min: 1 }),
  body('services.*').isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const partenaireId = req.params.id;
    const { services } = req.body;

    // Vérifier que le partenaire existe
    const [partenaire] = await dbQuery(
      'SELECT id FROM partenaires WHERE id = ?',
      [partenaireId]
    );

    if (!partenaire) {
      return res.status(404).json({
        error: 'Partenaire non trouvé',
        message: 'Partenaire introuvable'
      });
    }

    // Vérifier que tous les services existent
    const existingServices = await dbQuery(
      'SELECT id FROM services WHERE id IN (?)',
      [services]
    );

    if (existingServices.length !== services.length) {
      return res.status(400).json({
        error: 'Services invalides',
        message: 'Certains services spécifiés n\'existent pas'
      });
    }

    // Supprimer les associations existantes
    await dbQuery('DELETE FROM partenaire_services WHERE partenaire_id = ?', [partenaireId]);

    // Créer les nouvelles associations
    for (const serviceId of services) {
      await dbQuery(
        'INSERT INTO partenaire_services (partenaire_id, service_id) VALUES (?, ?)',
        [partenaireId, serviceId]
      );
    }

    res.json({
      message: 'Services associés au partenaire avec succès'
    });

  } catch (error) {
    console.error('Erreur association services partenaire:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de l\'association des services'
    });
  }
});

// Récupérer les services d'un partenaire
router.get('/partenaires/:id/services', async (req, res) => {
  try {
    const partenaireId = req.params.id;

    const services = await dbQuery(
      `SELECT s.* FROM services s
       JOIN partenaire_services ps ON s.id = ps.service_id
       WHERE ps.partenaire_id = ?`,
      [partenaireId]
    );

    res.json({
      services
    });

  } catch (error) {
    console.error('Erreur récupération services partenaire:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des services du partenaire'
    });
  }
});

module.exports = router; 
