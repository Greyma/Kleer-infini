const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Inscription d'un nouvel utilisateur
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  // Accept both FR and EN field names
  body(['nom','firstName']).notEmpty(),
  body(['prenom','lastName']).notEmpty(),
  body(['telephone','phone']).optional().isString(),
  body('profession').optional().isString(),
  body('experience').optional().isInt({ min: 0 }),
  body('role').optional().isIn(['client', 'partner', 'candidat'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const { email, password } = req.body;
    const nom = req.body.nom || req.body.firstName;
    const prenom = req.body.prenom || req.body.lastName;
    const telephone = req.body.telephone || req.body.phone || null;
    const profession = req.body.profession || null;
    const experience = req.body.experience ?? null;
    const role = req.body.role || 'client';

    // Vérifier si l'email existe déjà
    const [existingUser] = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'Email déjà utilisé',
        message: 'Un compte avec cet email existe déjà'
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Insérer le nouvel utilisateur
    const [result] = await query(
      `INSERT INTO users (email, password, nom, prenom, telephone, profession, experience, role, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [email, hashedPassword, nom, prenom, telephone, profession, experience, role]
    );

    // Générer le token JWT
    const token = jwt.sign(
      { userId: result.insertId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: {
        id: result.insertId,
        firstName: nom,
        lastName: prenom,
        email,
        phone: telephone,
        profession,
        experience: experience !== null ? Number(experience) : null,
        role,
        subscriptionStatus: 'free',
        createdAt: new Date().toISOString()
      },
      token
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la création du compte'
    });
  }
});

// Connexion utilisateur
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Récupérer l'utilisateur
    const [user] = await query(
      'SELECT id, email, password, nom, prenom, role, status FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le statut du compte
    if (user.status !== 'active' && user.status !== 'pending') {
      return res.status(403).json({
        error: 'Compte désactivé',
        message: 'Votre compte a été désactivé. Contactez l\'administrateur.'
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        status: user.status
      },
      token
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la connexion'
    });
  }
});

// Récupérer le profil utilisateur connecté
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [user] = await query(
      `SELECT id, email, nom, prenom, telephone, profession, experience, role, status, created_at, updated_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        message: 'Profil utilisateur introuvable'
      });
    }

    // Fetch latest subscription to compute status
    const subscriptions = await query(
      `SELECT status, date_debut, date_fin FROM subscriptions WHERE user_id = ? ORDER BY date_fin DESC LIMIT 1`,
      [req.user.id]
    );
    let subscriptionStatus = 'free';
    let subscriptionEndDate = null;
    if (subscriptions.length) {
      const sub = subscriptions[0];
      const now = new Date();
      const endsAt = new Date(sub.date_fin);
      subscriptionEndDate = endsAt.toISOString();
      if (sub.status === 'active' && endsAt > now) subscriptionStatus = 'premium';
      else if (endsAt <= now) subscriptionStatus = 'expired';
    }

    res.json({
      user: {
        id: user.id,
        firstName: user.nom,
        lastName: user.prenom,
        email: user.email,
        phone: user.telephone,
        profession: user.profession || null,
        experience: user.experience !== null ? Number(user.experience) : null,
        role: user.role,
        subscriptionStatus,
        subscriptionEndDate,
        createdAt: new Date(user.created_at).toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

// Mettre à jour le profil utilisateur
router.put('/profile', [
  authenticateToken,
  body('nom').optional().notEmpty().trim(),
  body('prenom').optional().notEmpty().trim(),
  body('telephone').optional().isMobilePhone('fr-FR')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const { nom, prenom, telephone } = req.body;
    const updateFields = [];
    const updateValues = [];

    if (nom) {
      updateFields.push('nom = ?');
      updateValues.push(nom);
    }
    if (prenom) {
      updateFields.push('prenom = ?');
      updateValues.push(prenom);
    }
    if (telephone) {
      updateFields.push('telephone = ?');
      updateValues.push(telephone);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Aucune donnée à mettre à jour',
        message: 'Veuillez fournir au moins un champ à modifier'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(req.user.id);

    await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      message: 'Profil mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
});

// Changer le mot de passe
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Récupérer le mot de passe actuel
    const [user] = await query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    // Vérifier l'ancien mot de passe
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Mot de passe incorrect',
        message: 'Le mot de passe actuel est incorrect'
      });
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Mettre à jour le mot de passe
    await query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedNewPassword, req.user.id]
    );

    res.json({
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors du changement de mot de passe'
    });
  }
});

// Déconnexion (côté client - invalider le token)
router.post('/logout', authenticateToken, (req, res) => {
  // En production, vous pourriez implémenter une liste noire de tokens
  res.json({
    message: 'Déconnexion réussie'
  });
});

module.exports = router; 
