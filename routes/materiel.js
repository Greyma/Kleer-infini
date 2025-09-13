const express = require('express');
const { body, validationResult } = require('express-validator');
const { query: dbQuery } = require('../config/database');
const { authenticateToken, requireAdminOrModerator } = require('../middleware/auth');
const { uploadDocument, uploadToS3 } = require('../utils/upload');
const router = express.Router();

// Créer un nouveau produit
router.post('/produits', [
  requireAdminOrModerator,
  body('nom').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('categorie').notEmpty().trim(),
  body('marque').notEmpty().trim(),
  body('reference').notEmpty().trim(),
  body('prix').isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('specifications').optional().trim(),
  body('disponibilite').optional().isBoolean()
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
      marque,
      reference,
      prix,
      stock,
      specifications,
      disponibilite = true
    } = req.body;

    let imageUrl = null;
    let imageKey = null;

    if (req.file) {
      const imageFile = await uploadToS3(req.file, 'produits');
      imageUrl = imageFile.url;
      imageKey = imageFile.key;
    }

    const [result] = await dbQuery(
      `INSERT INTO produits (
        nom, description, categorie, marque, reference, prix,
        stock, specifications, image_url, image_key, disponibilite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nom, description, categorie, marque, reference, prix, stock || 0, specifications || null, imageUrl, imageKey, disponibilite]
    );

    res.status(201).json({
      message: 'Produit créé avec succès',
      produit: {
        id: result.insertId,
        nom,
        categorie,
        marque
      }
    });

  } catch (error) {
    console.error('Erreur création produit:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la création du produit'
    });
  }
});

// Lister tous les produits avec filtres
router.get('/produits', async (req, res) => {
  try {
    const { 
      categorie, 
      marque, 
      prix_min, 
      prix_max, 
      disponibilite, 
      stock_min,
      search,
      page = 1, 
      limit = 12 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '1=1';
    let params = [];

    if (categorie) {
      whereClause += ' AND categorie = ?';
      params.push(categorie);
    }

    if (marque) {
      whereClause += ' AND marque = ?';
      params.push(marque);
    }

    if (prix_min) {
      whereClause += ' AND prix >= ?';
      params.push(parseFloat(prix_min));
    }

    if (prix_max) {
      whereClause += ' AND prix <= ?';
      params.push(parseFloat(prix_max));
    }

    if (disponibilite !== undefined) {
      whereClause += ' AND disponibilite = ?';
      params.push(disponibilite === 'true');
    }

    if (stock_min) {
      whereClause += ' AND stock >= ?';
      params.push(parseInt(stock_min));
    }

    if (search) {
      whereClause += ' AND (nom LIKE ? OR description LIKE ? OR reference LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Compter le total
    const [countResult] = await dbQuery(
      `SELECT COUNT(*) as total FROM produits WHERE ${whereClause}`,
      params
    );

    // Récupérer les produits
    const produits = await dbQuery(
      `SELECT * FROM produits WHERE ${whereClause} ORDER BY nom LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    const DEFAULT_IMAGE = '/images/default.jpg';
    const produitsMapped = produits.map(p => ({
      ...p,
      image_url: p.image_url || DEFAULT_IMAGE
    }));

    res.json({
      produits: produitsMapped,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limitNum)
      }
    });

  } catch (error) {
    console.error('Erreur récupération produits:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des produits'
    });
  }
});

// Récupérer un produit spécifique
router.get('/produits/:id', async (req, res) => {
  try {
    const produitId = req.params.id;

    const [produit] = await dbQuery(
      'SELECT * FROM produits WHERE id = ?',
      [produitId]
    );

    if (!produit) {
      return res.status(404).json({
        error: 'Produit non trouvé',
        message: 'Produit introuvable'
      });
    }

    const DEFAULT_IMAGE = '/images/default.jpg';
    res.json({
      produit: { ...produit, image_url: produit.image_url || DEFAULT_IMAGE }
    });

  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération du produit'
    });
  }
});

// Mettre à jour un produit
router.put('/produits/:id', [
  requireAdminOrModerator,
  body('nom').optional().notEmpty().trim(),
  body('description').optional().notEmpty().trim(),
  body('categorie').optional().notEmpty().trim(),
  body('marque').optional().notEmpty().trim(),
  body('reference').optional().notEmpty().trim(),
  body('prix').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('specifications').optional().trim(),
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

    const produitId = req.params.id;
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
    updateValues.push(produitId);

    // Vérifier que le produit existe
    const [produit] = await dbQuery(
      'SELECT id FROM produits WHERE id = ?',
      [produitId]
    );

    if (!produit) {
      return res.status(404).json({
        error: 'Produit non trouvé',
        message: 'Produit introuvable'
      });
    }

    await dbQuery(
      `UPDATE produits SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      message: 'Produit mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour produit:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du produit'
    });
  }
});

// Supprimer un produit
router.delete('/produits/:id', requireAdminOrModerator, async (req, res) => {
  try {
    const produitId = req.params.id;

    // Vérifier que le produit existe
    const [produit] = await dbQuery(
      'SELECT id FROM produits WHERE id = ?',
      [produitId]
    );

    if (!produit) {
      return res.status(404).json({
        error: 'Produit non trouvé',
        message: 'Produit introuvable'
      });
    }

    await dbQuery('DELETE FROM produits WHERE id = ?', [produitId]);

    res.json({
      message: 'Produit supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la suppression du produit'
    });
  }
});

// Récupérer les catégories de produits
router.get('/categories', async (req, res) => {
  try {
    const categories = await dbQuery(
      'SELECT DISTINCT categorie, COUNT(*) as nombre_produits FROM produits GROUP BY categorie ORDER BY categorie'
    );

    res.json({
      categories
    });

  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des catégories'
    });
  }
});

// Récupérer les marques de produits
router.get('/marques', async (req, res) => {
  try {
    const marques = await dbQuery(
      'SELECT DISTINCT marque, COUNT(*) as nombre_produits FROM produits GROUP BY marque ORDER BY marque'
    );

    res.json({
      marques
    });

  } catch (error) {
    console.error('Erreur récupération marques:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération des marques'
    });
  }
});

// Mettre à jour le stock d'un produit
router.put('/produits/:id/stock', [
  requireAdminOrModerator,
  body('stock').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const produitId = req.params.id;
    const { stock } = req.body;

    // Vérifier que le produit existe
    const [produit] = await dbQuery(
      'SELECT id FROM produits WHERE id = ?',
      [produitId]
    );

    if (!produit) {
      return res.status(404).json({
        error: 'Produit non trouvé',
        message: 'Produit introuvable'
      });
    }

    await dbQuery(
      'UPDATE produits SET stock = ?, updated_at = NOW() WHERE id = ?',
      [stock, produitId]
    );

    res.json({
      message: 'Stock mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour stock:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du stock'
    });
  }
});

module.exports = router; 
