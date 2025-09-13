const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Dashboard - Statistiques générales
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // Statistiques utilisateurs
    const [userStats] = await dbQuery(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'client' THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN role = 'partner' THEN 1 ELSE 0 END) as partenaires,
        SUM(CASE WHEN role = 'candidat' THEN 1 ELSE 0 END) as candidats,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as actifs
      FROM users
    `);

    // Statistiques candidatures
    const [candidatureStats] = await dbQuery(`
      SELECT 
        COUNT(*) as total_candidatures,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as examinees,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as acceptees,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejetees
      FROM candidatures
    `);

    // Statistiques entreprises
    const [entrepriseStats] = await dbQuery(`
      SELECT 
        COUNT(*) as total_entreprises,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approuvees,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejetees
      FROM entreprises
    `);

    // Statistiques devis
    const [devisStats] = await dbQuery(`
      SELECT 
        COUNT(*) as total_devis,
        SUM(CASE WHEN status = 'en_attente' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN status = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN status = 'accepte' THEN 1 ELSE 0 END) as acceptes,
        SUM(CASE WHEN status = 'refuse' THEN 1 ELSE 0 END) as refuses,
        SUM(CASE WHEN status = 'termine' THEN 1 ELSE 0 END) as termines,
        SUM(montant_total) as chiffre_affaires_total
      FROM devis
    `);

    // Statistiques produits
    const [produitStats] = await dbQuery(`
      SELECT 
        COUNT(*) as total_produits,
        SUM(CASE WHEN disponibilite = 1 THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as en_stock,
        SUM(stock) as stock_total
      FROM produits
    `);

    // Activité récente
    const activiteRecente = await dbQuery(`
      (SELECT 'candidature' as type, c.created_at, u.nom, u.prenom, c.poste as detail
       FROM candidatures c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'devis' as type, d.created_at, u.nom, u.prenom, CONCAT('Devis #', d.id) as detail
       FROM devis d
       JOIN users u ON d.client_id = u.id
       ORDER BY d.created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'entreprise' as type, e.created_at, u.nom, u.prenom, e.nom_entreprise as detail
       FROM entreprises e
       JOIN users u ON e.user_id = u.id
       ORDER BY e.created_at DESC LIMIT 5)
      ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      userStats,
      candidatureStats,
      entrepriseStats,
      devisStats,
      produitStats,
      activiteRecente
    });

  } catch (error) {
    console.error('Erreur récupération dashboard:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Gestion des utilisateurs
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { role, status } = req.query;
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '1=1';
    let params = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
      params
    );

    // Récupérer les utilisateurs
    const users = await dbQuery(
      `SELECT id, email, nom, prenom, telephone, role, status, created_at, updated_at
       FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limitNum)
      }
    });

  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

// Modifier le statut d'un utilisateur
router.put('/users/:id/status', [
  requireAdmin,
  body('status').isIn(['pending', 'active', 'inactive']),
  body('role').optional().isIn(['client', 'partner', 'candidat', 'moderator', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const userId = req.params.id;
    const { status, role } = req.body;

    // Vérifier que l'utilisateur existe
    const [user] = await dbQuery(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        message: 'Utilisateur introuvable'
      });
    }

    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const updateValues = [status];

    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }

    updateValues.push(userId);

    await dbQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      message: 'Statut de l\'utilisateur mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour de l\'utilisateur'
    });
  }
});

// Supprimer un utilisateur
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Vérifier que l'utilisateur existe
    const [user] = await dbQuery(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        message: 'Utilisateur introuvable'
      });
    }

    // Supprimer les données associées
    await dbQuery('DELETE FROM candidatures WHERE user_id = ?', [userId]);
    await dbQuery('DELETE FROM entreprises WHERE user_id = ?', [userId]);
    await dbQuery('DELETE FROM devis WHERE client_id = ?', [userId]);
    await dbQuery('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      message: 'Utilisateur supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la suppression de l\'utilisateur'
    });
  }
});

// Rapports et exports
router.get('/reports/candidatures', requireAdmin, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    let whereClause = '1=1';
    let params = [];

    if (date_debut && date_fin) {
      whereClause += ' AND c.created_at BETWEEN ? AND ?';
      params.push(date_debut, date_fin);
    }

    const candidatures = await dbQuery(
      `SELECT c.*, u.nom, u.prenom, u.email, u.telephone
       FROM candidatures c
       JOIN users u ON c.user_id = u.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC`,
      params
    );

    res.json({
      candidatures,
      total: candidatures.length
    });

  } catch (error) {
    console.error('Erreur génération rapport candidatures:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la génération du rapport'
    });
  }
});

router.get('/reports/devis', requireAdmin, async (req, res) => {
  try {
    const { date_debut, date_fin, status } = req.query;

    let whereClause = '1=1';
    let params = [];

    if (date_debut && date_fin) {
      whereClause += ' AND d.created_at BETWEEN ? AND ?';
      params.push(date_debut, date_fin);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    const devis = await dbQuery(
      `SELECT d.*, u.nom, u.prenom, u.email, u.telephone
       FROM devis d
       JOIN users u ON d.client_id = u.id
       WHERE ${whereClause}
       ORDER BY d.created_at DESC`,
      params
    );

    const totalChiffreAffaires = devis.reduce((sum, devis) => sum + (devis.montant_total || 0), 0);

    res.json({
      devis,
      total: devis.length,
      chiffre_affaires_total: totalChiffreAffaires
    });

  } catch (error) {
    console.error('Erreur génération rapport devis:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la génération du rapport'
    });
  }
});

// Configuration système
router.get('/config', requireAdmin, async (req, res) => {
  try {
    // Récupérer les paramètres de configuration
    const config = {
      site_name: 'Garoui Electricité',
      contact_email: process.env.EMAIL_USER,
      max_file_size: '10MB',
      allowed_file_types: ['PDF', 'DOC', 'DOCX', 'JPG', 'PNG'],
      rate_limit: {
        window_ms: process.env.RATE_LIMIT_WINDOW_MS || 900000,
        max_requests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
      }
    };

    res.json({
      config
    });

  } catch (error) {
    console.error('Erreur récupération config:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération de la configuration'
    });
  }
});

module.exports = router; 
