const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdminOrModerator, requireClient } = require('../middleware/auth');
const router = express.Router();

// Créer un nouveau service
router.post('/catalogue', [
  requireAdminOrModerator,
  body('nom').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('categorie').notEmpty().trim(),
  body('prix_base').isFloat({ min: 0 }),
  body('duree_estimee').optional().isInt({ min: 1 }),
  body('disponibilite').optional().isBoolean()
], async (req, res) => {
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
      prix_base,
      duree_estimee,
      disponibilite = true
    } = req.body;

    const [result] = await dbQuery(
      `INSERT INTO services (
        nom, description, categorie, prix_base, duree_estimee,
        disponibilite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [nom, description, categorie, prix_base, duree_estimee || null, disponibilite]
    );

    res.status(201).json({
      message: 'Service créé avec succès',
      service: {
        id: result.insertId,
        nom,
        categorie
      }
    });

  } catch (error) {
    console.error('Erreur création service:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la création du service'
    });
  }
});

// Lister tous les services
router.get('/catalogue', async (req, res) => {
  try {
    const { categorie, disponibilite, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];

    if (categorie) {
      whereClause += ' AND categorie = ?';
      params.push(categorie);
    }

    if (disponibilite !== undefined) {
      whereClause += ' AND disponibilite = ?';
      params.push(disponibilite === 'true');
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM services WHERE ${whereClause}`,
      params
    );

    // Récupérer les services
    const services = await dbQuery(
      `SELECT * FROM services WHERE ${whereClause} ORDER BY nom LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur récupération services:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des services'
    });
  }
});

// Récupérer un service spécifique
router.get('/catalogue/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;

    const [service] = await dbQuery(
      'SELECT * FROM services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      return res.status(404).json({
        error: 'Service non trouvé',
        message: 'Service introuvable'
      });
    }

    res.json({
      service
    });

  } catch (error) {
    console.error('Erreur récupération service:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération du service'
    });
  }
});

// Mettre à jour un service
router.put('/catalogue/:id', [
  requireAdminOrModerator,
  body('nom').optional().notEmpty().trim(),
  body('description').optional().notEmpty().trim(),
  body('categorie').optional().notEmpty().trim(),
  body('prix_base').optional().isFloat({ min: 0 }),
  body('duree_estimee').optional().isInt({ min: 1 }),
  body('disponibilite').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const serviceId = req.params.id;
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
    updateValues.push(serviceId);

    // Vérifier que le service existe
    const [service] = await dbQuery(
      'SELECT id FROM services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      return res.status(404).json({
        error: 'Service non trouvé',
        message: 'Service introuvable'
      });
    }

    await dbQuery(
      `UPDATE services SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      message: 'Service mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour service:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du service'
    });
  }
});

// Supprimer un service
router.delete('/catalogue/:id', requireAdminOrModerator, async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Vérifier que le service existe
    const [service] = await dbQuery(
      'SELECT id FROM services WHERE id = ?',
      [serviceId]
    );

    if (!service) {
      return res.status(404).json({
        error: 'Service non trouvé',
        message: 'Service introuvable'
      });
    }

    await dbQuery('DELETE FROM services WHERE id = ?', [serviceId]);

    res.json({
      message: 'Service supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression service:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la suppression du service'
    });
  }
});

// Créer une demande de devis
router.post('/devis', [
  requireClient,
  body('services').isArray({ min: 1 }),
  body('services.*.service_id').isInt({ min: 1 }),
  body('services.*.quantite').isInt({ min: 1 }),
  body('date_souhaitee').isISO8601().toDate(),
  body('adresse_intervention').notEmpty().trim(),
  body('description_besoin').optional().trim(),
  body('urgence').optional().isIn(['normale', 'urgente', 'tres_urgente'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const {
      services,
      date_souhaitee,
      adresse_intervention,
      description_besoin,
      urgence = 'normale'
    } = req.body;

    // Vérifier que tous les services existent
    const serviceIds = services.map(s => s.service_id);
    const existingServices = await dbQuery(
      'SELECT id, nom, prix_base FROM services WHERE id IN (?)',
      [serviceIds]
    );

    if (existingServices.length !== services.length) {
      return res.status(400).json({
        error: 'Services invalides',
        message: 'Certains services spécifiés n\'existent pas'
      });
    }

    // Calculer le montant total
    let montant_total = 0;
    const servicesDetails = [];

    for (const service of services) {
      const serviceInfo = existingServices.find(s => s.id === service.service_id);
      const montant = serviceInfo.prix_base * service.quantite;
      montant_total += montant;
      
      servicesDetails.push({
        service_id: service.service_id,
        nom_service: serviceInfo.nom,
        quantite: service.quantite,
        prix_unitaire: serviceInfo.prix_base,
        montant: montant
      });
    }

    // Insérer la demande de devis
    const [result] = await dbQuery(
      `INSERT INTO devis (
        client_id, date_souhaitee, adresse_intervention, description_besoin,
        urgence, montant_total, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'en_attente', NOW())`,
      [req.user.id, date_souhaitee, adresse_intervention, description_besoin || null, urgence, montant_total]
    );

    // Insérer les détails des services
    for (const service of servicesDetails) {
      await dbQuery(
        `INSERT INTO devis_services (
          devis_id, service_id, quantite, prix_unitaire, montant
        ) VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, service.service_id, service.quantite, service.prix_unitaire, service.montant]
      );
    }

    res.status(201).json({
      message: 'Demande de devis créée avec succès',
      devis: {
        id: result.insertId,
        montant_total,
        status: 'en_attente'
      }
    });

  } catch (error) {
    console.error('Erreur création devis:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la création de la demande de devis'
    });
  }
});

// Récupérer les devis du client connecté
router.get('/mes-devis', requireClient, async (req, res) => {
  try {
    const devis = await dbQuery(
      `SELECT d.*, COUNT(ds.id) as nombre_services
       FROM devis d
       LEFT JOIN devis_services ds ON d.id = ds.devis_id
       WHERE d.client_id = ?
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );

    res.json({
      devis
    });

  } catch (error) {
    console.error('Erreur récupération devis:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des devis'
    });
  }
});

// Récupérer un devis spécifique
router.get('/devis/:id', authenticateToken, async (req, res) => {
  try {
    const devisId = req.params.id;

    // Récupérer le devis
    const [devis] = await dbQuery(
      `SELECT d.*, u.nom, u.prenom, u.email, u.telephone
       FROM devis d
       JOIN users u ON d.client_id = u.id
       WHERE d.id = ? AND (d.client_id = ? OR ? IN ('admin', 'moderator'))`,
      [devisId, req.user.id, req.user.role]
    );

    if (!devis) {
      return res.status(404).json({
        error: 'Devis non trouvé',
        message: 'Devis introuvable'
      });
    }

    // Récupérer les services du devis
    const services = await dbQuery(
      `SELECT ds.*, s.nom as nom_service, s.description
       FROM devis_services ds
       JOIN services s ON ds.service_id = s.id
       WHERE ds.devis_id = ?`,
      [devisId]
    );

    res.json({
      devis,
      services
    });

  } catch (error) {
    console.error('Erreur récupération devis:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération du devis'
    });
  }
});

// ADMIN: Lister tous les devis
router.get('/admin/devis', requireAdminOrModerator, async (req, res) => {
  try {
    const { status, urgence, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    if (urgence) {
      whereClause += ' AND d.urgence = ?';
      params.push(urgence);
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM devis d WHERE ${whereClause}`,
      params
    );

    // Récupérer les devis
    const devis = await dbQuery(
      `SELECT d.*, u.nom, u.prenom, u.email, u.telephone
       FROM devis d
       JOIN users u ON d.client_id = u.id
       WHERE ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      devis,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur récupération devis admin:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des devis'
    });
  }
});

// ADMIN: Modifier le statut d'un devis
router.put('/admin/devis/:id/status', [
  requireAdminOrModerator,
  body('status').isIn(['en_attente', 'en_cours', 'accepte', 'refuse', 'termine']),
  body('commentaire').optional().trim(),
  body('prix_final').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const devisId = req.params.id;
    const { status, commentaire, prix_final } = req.body;

    // Vérifier que le devis existe
    const [devis] = await dbQuery(
      'SELECT id FROM devis WHERE id = ?',
      [devisId]
    );

    if (!devis) {
      return res.status(404).json({
        error: 'Devis non trouvé',
        message: 'Devis introuvable'
      });
    }

    const updateFields = ['status = ?', 'commentaire_admin = ?', 'updated_at = NOW()'];
    const updateValues = [status, commentaire || null];

    if (prix_final !== undefined) {
      updateFields.push('prix_final = ?');
      updateValues.push(prix_final);
    }

    updateValues.push(devisId);

    await dbQuery(
      `UPDATE devis SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      message: 'Statut du devis mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour statut devis:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

module.exports = router; 