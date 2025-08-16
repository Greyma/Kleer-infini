// routes/offres-abonnes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Voir les abonnés (candidats) ayant postulé à une offre (pour le sous-traitant ou admin)
router.get('/:offreId/abonnes', auth, async (req, res) => {
  const offreId = req.params.offreId;
  const userId = req.user.id;
  try {
    // Vérifier que l'utilisateur est admin ou propriétaire de l'offre
    let offre;
    if (req.user.role === 'admin') {
      [offre] = await db.query('SELECT * FROM offres WHERE id = ?', [offreId]);
    } else {
      [offre] = await db.query('SELECT * FROM offres WHERE id = ? AND user_id = ?', [offreId, userId]);
    }
    if (!offre.length) return res.status(403).json({ error: 'Accès refusé à cette offre' });

    // Récupérer les candidatures liées à l'offre
    const [candidatures] = await db.query('SELECT * FROM candidatures WHERE offre_id = ?', [offreId]);
    // Récupérer les infos d'abonnement pour chaque candidat
    const abonnes = [];
    for (const c of candidatures) {
      const [abonnement] = await db.query('SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND date_fin > NOW() ORDER BY date_fin DESC LIMIT 1', [c.user_id]);
      abonnes.push({
        candidat_id: c.user_id,
        candidature_id: c.id,
        abonnement: abonnement[0] || null
      });
    }
    res.json({ abonnes });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
