// routes/offres-abonnes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Voir les candidatures à une offre (applications)
router.get('/:offreId/abonnes', authenticateToken, async (req, res) => {
  const offreId = req.params.offreId;
  const userId = req.user.id;
  try {
    // Vérifier que l'utilisateur est admin ou propriétaire de l'offre
    let offre;
    if (req.user.role === 'admin') {
      [offre] = await db.query('SELECT id FROM offres WHERE id = ?', [offreId]);
    } else {
      [offre] = await db.query('SELECT id FROM offres WHERE id = ? AND user_id = ?', [offreId, userId]);
    }
    if (!offre.length) return res.status(403).json({ error: 'Accès refusé à cette offre' });

    // Récupérer les applications liées à l'offre
    const applications = await db.query('SELECT * FROM offer_applications WHERE offer_id = ? ORDER BY applied_at DESC', [offreId]);
    const mapped = applications.map(a => ({
      id: a.id,
      offerId: a.offer_id,
      userId: a.user_id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      cvUrl: a.cv_url || null,
      coverLetterUrl: a.cover_letter_url || null,
      status: a.status,
      appliedAt: a.applied_at
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
