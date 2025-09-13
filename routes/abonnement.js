// routes/abonnement.js
const express = require('express');
const router = express.Router();
const abonnementController = require('../controllers/abonnement');
const {authenticateToken} = require('../middleware/auth');

// Souscrire à un abonnement
router.post('/souscrire', authenticateToken, abonnementController.souscrire);

// Consulter son abonnement
router.get('/mon-abonnement', authenticateToken, abonnementController.monAbonnement);

// Annuler son abonnement
router.post('/annuler', authenticateToken, abonnementController.annuler);

// Liste des abonnements (admin)
router.get('/admin/abonnements', authenticateToken, abonnementController.listeAbonnements);

module.exports = router;
