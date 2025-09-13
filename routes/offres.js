// routes/offres.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { query: dbQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Public: Lister les offres actives (DTO frontend)
router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery(`
      SELECT o.*, e.nom_entreprise, e.raison_sociale
      FROM offres o
      LEFT JOIN entreprises e ON e.id = o.company_id
      WHERE o.is_active = 1 OR o.is_active IS NULL
      ORDER BY o.created_at DESC
    `);
    const offers = rows.map(o => ({
      id: o.id,
      companyId: o.company_id || null,
      companyName: o.raison_sociale || o.nom_entreprise || null,
      title: o.titre,
      description: o.description,
      requirements: o.requirements ? (() => { try { return JSON.parse(o.requirements); } catch { return null; } })() : null,
      contractType: o.contract_type || o.type || null,
      experienceRequired: o.experience_required != null ? Number(o.experience_required) : null,
      wilaya: o.wilaya || null,
      salaryMin: o.salary_min != null ? Number(o.salary_min) : null,
      salaryMax: o.salary_max != null ? Number(o.salary_max) : null,
      currency: o.currency || 'DZD',
      isActive: o.is_active == null ? true : Boolean(o.is_active),
      createdAt: o.created_at ? new Date(o.created_at).toISOString() : null
    }));
    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Créer une offre (accept new DTO keys; auth required)
router.post('/', authenticateToken, [
  body(['title','titre']).notEmpty(),
  body('description').notEmpty(),
  body(['contractType','type']).notEmpty(),
  body(['experienceRequired']).isInt({ min: 0 }),
  body('wilaya').notEmpty(),
  body('salaryMin').optional().isFloat({ min: 0 }),
  body('salaryMax').optional().isFloat({ min: 0 }),
  body('currency').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('companyId').optional().isInt({ min: 1 }),
  body('requirements').optional()
], async (req, res) => {
  if (req.user.role !== 'sous-traitant' && req.user.role !== 'partner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux sous-traitants et admin' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Données invalides', details: errors.array() });
  }
  const titre = req.body.titre || req.body.title;
  const description = req.body.description;
  const type = req.body.type || req.body.contractType;
  const experience_required = req.body.experienceRequired;
  const wilaya = req.body.wilaya;
  const salary_min = req.body.salaryMin ?? null;
  const salary_max = req.body.salaryMax ?? null;
  const currency = req.body.currency || 'DZD';
  const is_active = req.body.isActive === undefined ? 1 : (req.body.isActive ? 1 : 0);
  const company_id = req.body.companyId || null;
  const requirements = Array.isArray(req.body.requirements) ? JSON.stringify(req.body.requirements) : (req.body.requirements || null);
  // Legacy non-null columns fallback
  const now = new Date();
  const date_debut = now.toISOString().slice(0,10);
  const date_fin = new Date(now.getTime() + 30*24*60*60*1000).toISOString().slice(0,10);
  try {
    const result = await dbQuery(
      `INSERT INTO offres (
        user_id, company_id, titre, description, type, contract_type,
        experience_required, wilaya, salary_min, salary_max, currency, is_active,
        requirements, date_debut, date_fin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id, company_id, titre, description, type, type,
        experience_required, wilaya, salary_min, salary_max, currency, is_active,
        requirements, date_debut, date_fin
      ]
    );
    res.status(201).json({
      id: result.insertId,
      title: titre,
      contractType: type
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lire les offres de l'utilisateur connecté
router.get('/mine', authenticateToken, async (req, res) => {
  if (req.user.role !== 'sous-traitant' && req.user.role !== 'partner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux sous-traitants et admin' });
  }
  try {
    const rows = await dbQuery('SELECT * FROM offres WHERE user_id = ?', [req.user.id]);
    res.json({ offres: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Public: Lire une offre spécifique si active
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await dbQuery(
      `SELECT o.*, e.nom_entreprise, e.raison_sociale
       FROM offres o
       LEFT JOIN entreprises e ON e.id = o.company_id
       WHERE o.id = ? AND (o.is_active = 1 OR o.is_active IS NULL)`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Offre non trouvée' });
    const o = rows[0];
    return res.json({
      id: o.id,
      companyId: o.company_id || null,
      companyName: o.raison_sociale || o.nom_entreprise || null,
      title: o.titre,
      description: o.description,
      requirements: o.requirements ? (() => { try { return JSON.parse(o.requirements); } catch { return null; } })() : null,
      contractType: o.contract_type || o.type || null,
      experienceRequired: o.experience_required != null ? Number(o.experience_required) : null,
      wilaya: o.wilaya || null,
      salaryMin: o.salary_min != null ? Number(o.salary_min) : null,
      salaryMax: o.salary_max != null ? Number(o.salary_max) : null,
      currency: o.currency || 'DZD',
      isActive: o.is_active == null ? true : Boolean(o.is_active),
      createdAt: o.created_at ? new Date(o.created_at).toISOString() : null
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Modifier une offre
router.put('/:id', authenticateToken, [
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
    const {
      titre, description, type, date_debut, date_fin,
      title, contractType, experienceRequired, wilaya,
      salaryMin, salaryMax, currency, isActive, requirements
    } = req.body;
    const updatePairs = [];
    const updateValues = [];
    const setIf = (col, val) => { if (val !== undefined) { updatePairs.push(`${col} = ?`); updateValues.push(val); } };

    setIf('titre', titre || title);
    setIf('description', description);
    setIf('type', type || contractType);
    setIf('contract_type', type || contractType);
    setIf('experience_required', experienceRequired);
    setIf('wilaya', wilaya);
    setIf('salary_min', salaryMin);
    setIf('salary_max', salaryMax);
    setIf('currency', currency);
    if (isActive !== undefined) setIf('is_active', isActive ? 1 : 0);
    if (requirements !== undefined) setIf('requirements', Array.isArray(requirements) ? JSON.stringify(requirements) : requirements);
    setIf('date_debut', date_debut);
    setIf('date_fin', date_fin);

    if (!updatePairs.length) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }
    updatePairs.push('updated_at = NOW()');
    let sql;
    let params;
    if (req.user.role === 'admin') {
      sql = `UPDATE offres SET ${updatePairs.join(', ')} WHERE id = ?`;
      params = [...updateValues, req.params.id];
    } else {
      sql = `UPDATE offres SET ${updatePairs.join(', ')} WHERE id = ? AND user_id = ?`;
      params = [...updateValues, req.params.id, req.user.id];
    }
    const result = await dbQuery(sql, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Offre non trouvée ou non autorisée' });
    res.json({ message: 'Offre modifiée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une offre
router.delete('/:id', authenticateToken, async (req, res) => {
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
