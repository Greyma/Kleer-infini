// routes/abonnement.js
const express = require('express');
const router = express.Router();
const abonnementController = require('../controllers/abonnement');
const auth = require('../middleware/auth');

// Souscrire à un abonnement
router.post('/souscrire', auth, abonnementController.souscrire);

// Consulter son abonnement
router.get('/mon-abonnement', auth, abonnementController.monAbonnement);

// Annuler son abonnement
router.post('/annuler', auth, abonnementController.annuler);

// Liste des abonnements (admin)
router.get('/admin/abonnements', auth, abonnementController.listeAbonnements);

module.exports = router;
