const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdminOrModerator } = require('../middleware/auth');
const { uploadCV, uploadDiplome, uploadToS3, getSignedUrl } = require('../utils/upload');
const router = express.Router();

// Soumettre une candidature
router.post('/candidature', [
  body('poste').notEmpty().trim(),
  body('experience').isInt({ min: 0 }),
  body('formation').notEmpty().trim(),
  body('motivation').notEmpty().trim(),
  body('disponibilite').isISO8601().toDate(),
  body('salaire_souhaite').optional().isFloat({ min: 0 })
], uploadCV, async (req, res) => {
  // Vérification abonnement pour les électriciens
  if (req.user.role === 'candidat' || req.user.role === 'electricien') {
    const [rows] = await dbQuery(
      `SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND date_fin > NOW() ORDER BY date_fin DESC LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(403).json({
        error: 'Abonnement requis',
        message: 'Vous devez avoir un abonnement actif pour postuler aux offres.'
      });
    }
  }
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'CV requis',
        message: 'Veuillez fournir votre CV'
      });
    }

    const {
      poste,
      experience,
      formation,
      motivation,
      disponibilite,
      salaire_souhaite
    } = req.body;

    // Upload du CV vers S3
    const cvFile = await uploadToS3(req.file, 'cv');

    // Insérer la candidature
    const [result] = await dbQuery(
      `INSERT INTO candidatures (
        user_id, poste, experience, formation, motivation, 
        disponibilite, salaire_souhaite, cv_url, cv_key, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        req.user.id,
        poste,
        experience,
        formation,
        motivation,
        disponibilite,
        salaire_souhaite || null,
        cvFile.url,
        cvFile.key
      ]
    );

    res.status(201).json({
      message: 'Candidature soumise avec succès',
      candidature: {
        id: result.insertId,
        poste,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Erreur soumission candidature:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la soumission de la candidature'
    });
  }
});

// Ajouter un diplôme à une candidature
router.post('/candidature/:id/diplome', [
  body('nom_diplome').notEmpty().trim(),
  body('etablissement').notEmpty().trim(),
  body('annee_obtention').isInt({ min: 1950, max: new Date().getFullYear() })
], uploadDiplome, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Document requis',
        message: 'Veuillez fournir le document du diplôme'
      });
    }

    const candidatureId = req.params.id;
    const { nom_diplome, etablissement, annee_obtention } = req.body;

    // Vérifier que la candidature appartient à l'utilisateur
    const [candidature] = await dbQuery(
      'SELECT id FROM candidatures WHERE id = ? AND user_id = ?',
      [candidatureId, req.user.id]
    );

    if (!candidature) {
      return res.status(404).json({
        error: 'Candidature non trouvée',
        message: 'Candidature introuvable'
      });
    }

    // Upload du diplôme vers S3
    const diplomeFile = await uploadToS3(req.file, 'diplomes');

    // Insérer le diplôme
    await dbQuery(
      `INSERT INTO diplomes (
        candidature_id, nom_diplome, etablissement, annee_obtention, 
        document_url, document_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        candidatureId,
        nom_diplome,
        etablissement,
        annee_obtention,
        diplomeFile.url,
        diplomeFile.key
      ]
    );

    res.status(201).json({
      message: 'Diplôme ajouté avec succès'
    });

  } catch (error) {
    console.error('Erreur ajout diplôme:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de l\'ajout du diplôme'
    });
  }
});

// Récupérer les candidatures de l'utilisateur connecté
router.get('/mes-candidatures', authenticateToken, async (req, res) => {
  try {
    const candidatures = await dbQuery(
      `SELECT c.id, c.poste, c.experience, c.formation, c.motivation, 
              c.disponibilite, c.salaire_souhaite, c.status, c.created_at,
              COUNT(d.id) as nombre_diplomes
       FROM candidatures c
       LEFT JOIN diplomes d ON c.id = d.candidature_id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    res.json({
      candidatures
    });

  } catch (error) {
    console.error('Erreur récupération candidatures:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des candidatures'
    });
  }
});

// Récupérer une candidature spécifique
router.get('/candidature/:id', authenticateToken, async (req, res) => {
  try {
    const candidatureId = req.params.id;

    // Récupérer la candidature
    const [candidature] = await dbQuery(
      `SELECT c.*, u.nom, u.prenom, u.email, u.telephone
       FROM candidatures c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ? AND (c.user_id = ? OR ? IN ('admin', 'moderator'))`,
      [candidatureId, req.user.id, req.user.role]
    );

    if (!candidature) {
      return res.status(404).json({
        error: 'Candidature non trouvée',
        message: 'Candidature introuvable'
      });
    }

    // Récupérer les diplômes
    const diplomes = await dbQuery(
      'SELECT * FROM diplomes WHERE candidature_id = ?',
      [candidatureId]
    );

    // Générer les URLs signées pour les fichiers privés
    if (req.user.role === 'admin' || req.user.role === 'moderator') {
      candidature.cv_url_signed = await getSignedUrl(candidature.cv_key);
      
      for (let diplome of diplomes) {
        diplome.document_url_signed = await getSignedUrl(diplome.document_key);
      }
    }

    res.json({
      candidature,
      diplomes
    });

  } catch (error) {
    console.error('Erreur récupération candidature:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération de la candidature'
    });
  }
});

// ADMIN/MODERATEUR: Lister toutes les candidatures
router.get('/admin/candidatures', requireAdminOrModerator, async (req, res) => {
  try {
    const { status, poste } = req.query;
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '1=1';
    let params = [];

    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    if (poste) {
      whereClause += ' AND c.poste LIKE ?';
      params.push(`%${poste}%`);
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM candidatures c WHERE ${whereClause}`,
      params
    );

    // Récupérer les candidatures
    const candidatures = await dbQuery(
      `SELECT c.id, c.poste, c.experience, c.formation, c.motivation, 
              c.disponibilite, c.salaire_souhaite, c.status, c.created_at,
              u.nom, u.prenom, u.email, u.telephone
       FROM candidatures c
       JOIN users u ON c.user_id = u.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    res.json({
      candidatures,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limitNum)
      }
    });

  } catch (error) {
    console.error('Erreur récupération candidatures admin:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des candidatures'
    });
  }
});

// ADMIN/MODERATEUR: Modifier le statut d'une candidature
router.put('/admin/candidature/:id/status', [
  requireAdminOrModerator,
  body('status').isIn(['pending', 'reviewed', 'accepted', 'rejected']),
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

    const candidatureId = req.params.id;
    const { status, commentaire } = req.body;

    // Vérifier que la candidature existe
    const [candidature] = await dbQuery(
      'SELECT id FROM candidatures WHERE id = ?',
      [candidatureId]
    );

    if (!candidature) {
      return res.status(404).json({
        error: 'Candidature non trouvée',
        message: 'Candidature introuvable'
      });
    }

    // Mettre à jour le statut
    await dbQuery(
      'UPDATE candidatures SET status = ?, commentaire_admin = ?, updated_at = NOW() WHERE id = ?',
      [status, commentaire || null, candidatureId]
    );

    res.json({
      message: 'Statut de la candidature mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour statut candidature:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

// ADMIN: Supprimer une candidature
router.delete('/admin/candidature/:id', requireAdminOrModerator, async (req, res) => {
  try {
    const candidatureId = req.params.id;

    // Vérifier que la candidature existe
    const [candidature] = await dbQuery(
      'SELECT cv_key FROM candidatures WHERE id = ?',
      [candidatureId]
    );

    if (!candidature) {
      return res.status(404).json({
        error: 'Candidature non trouvée',
        message: 'Candidature introuvable'
      });
    }

    // Supprimer les diplômes associés
    await dbQuery('DELETE FROM diplomes WHERE candidature_id = ?', [candidatureId]);

    // Supprimer la candidature
    await dbQuery('DELETE FROM candidatures WHERE id = ?', [candidatureId]);

    res.json({
      message: 'Candidature supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression candidature:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la suppression de la candidature'
    });
  }
});

// Récupérer les statistiques de recrutement (admin uniquement)
router.get('/admin/stats', requireAdminOrModerator, async (req, res) => {
  try {
    const stats = await dbQuery(`
      SELECT 
        COUNT(*) as total_candidatures,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as examinees,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as acceptees,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejetees,
        COUNT(DISTINCT user_id) as candidats_uniques
      FROM candidatures
    `);

    const postesStats = await dbQuery(`
      SELECT poste, COUNT(*) as nombre
      FROM candidatures
      GROUP BY poste
      ORDER BY nombre DESC
      LIMIT 10
    `);

    res.json({
      stats: stats[0],
      postes_populaires: postesStats
    });

  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router; 
