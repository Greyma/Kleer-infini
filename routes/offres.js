// routes/offres.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

// Créer une offre
router.post('/', auth, [
  body('titre').notEmpty(),
  body('description').notEmpty(),
  body('type').notEmpty(),
  body('date_debut').isISO8601(),
  body('date_fin').isISO8601()
], async (req, res) => {
  if (req.user.role !== 'sous-traitant' && req.user.role !== 'partner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux sous-traitants et admin' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Données invalides', details: errors.array() });
  }
  const { titre, description, type, date_debut, date_fin } = req.body;
  try {
    const [result] = await db.query('INSERT INTO offres (user_id, titre, description, type, date_debut, date_fin, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', [req.user.id, titre, description, type, date_debut, date_fin]);
    res.status(201).json({ message: 'Offre créée', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lire toutes les offres de l'utilisateur connecté
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'sous-traitant' && req.user.role !== 'partner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux sous-traitants et admin' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM offres WHERE user_id = ?', [req.user.id]);
    res.json({ offres: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lire une offre spécifique
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM offres WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    // Si admin, il peut voir toutes les offres
    if (req.user.role === 'admin') {
      const [adminRows] = await db.query('SELECT * FROM offres WHERE id = ?', [req.params.id]);
      if (adminRows.length) return res.json({ offre: adminRows[0] });
    }
    if (!rows.length) return res.status(404).json({ error: 'Offre non trouvée' });
    res.json({ offre: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier une offre
router.put('/:id', auth, [
  body('titre').optional().notEmpty(),
  body('description').optional().notEmpty(),
  body('type').optional().notEmpty(),
  body('date_debut').optional().isISO8601(),
  body('date_fin').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Données invalides', details: errors.array() });
    }
    const { titre, description, type, date_debut, date_fin } = req.body;
    let result;
    if (req.user.role === 'admin') {
      [result] = await db.query('UPDATE offres SET titre = COALESCE(?, titre), description = COALESCE(?, description), type = COALESCE(?, type), date_debut = COALESCE(?, date_debut), date_fin = COALESCE(?, date_fin) WHERE id = ?', [titre, description, type, date_debut, date_fin, req.params.id]);
    } else {
      [result] = await db.query('UPDATE offres SET titre = COALESCE(?, titre), description = COALESCE(?, description), type = COALESCE(?, type), date_debut = COALESCE(?, date_debut), date_fin = COALESCE(?, date_fin) WHERE id = ? AND user_id = ?', [titre, description, type, date_debut, date_fin, req.params.id, req.user.id]);
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Offre non trouvée ou non autorisée' });
    res.json({ message: 'Offre modifiée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une offre
router.delete('/:id', auth, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      [result] = await db.query('DELETE FROM offres WHERE id = ?', [req.params.id]);
    } else {
      [result] = await db.query('DELETE FROM offres WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Offre non trouvée ou non autorisée' });
    res.json({ message: 'Offre supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
