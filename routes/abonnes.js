// routes/abonnes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Liste des abonnés (candidats ayant un abonnement actif)
router.get('/', auth, async (req, res) => {
  // Admin : accès à tous les abonnés
  if (req.user.role === 'admin') {
    try {
      const [rows] = await db.query('SELECT * FROM subscriptions WHERE status = "active" AND date_fin > NOW()');
      res.json({ abonnes: rows });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } else if (req.user.role === 'sous-traitant' || req.user.role === 'partner') {
    // Sous-traitant : accès aux abonnés ayant postulé à ses offres
    try {
      // Récupérer les offres de l'utilisateur
      const [offres] = await db.query('SELECT id FROM offres WHERE user_id = ?', [req.user.id]);
      const offreIds = offres.map(o => o.id);
      if (!offreIds.length) return res.json({ abonnes: [] });
      // Récupérer les candidatures sur ces offres
      const [candidatures] = await db.query('SELECT DISTINCT user_id FROM candidatures WHERE offre_id IN (?)', [offreIds]);
      const userIds = candidatures.map(c => c.user_id);
      if (!userIds.length) return res.json({ abonnes: [] });
      // Récupérer les abonnements actifs de ces utilisateurs
      const [abonnes] = await db.query('SELECT * FROM subscriptions WHERE user_id IN (?) AND status = "active" AND date_fin > NOW()', [userIds]);
      res.json({ abonnes });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } else {
    return res.status(403).json({ error: 'Accès refusé' });
  }
});

module.exports = router;
