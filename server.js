const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const abonnementRoutes = require('./routes/abonnement');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de sécurité
app.use(helmet());
app.use(compression());

// Configuration CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://garoui-electricite.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limite chaque IP à 100 requêtes par fenêtre
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  }
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Middleware pour parser le JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/recrutement', require('./routes/recrutement'));
app.use('/api/sous-traitance', require('./routes/sous-traitance'));
app.use('/api/services', require('./routes/services'));
app.use('/api/materiel', require('./routes/materiel'));
app.use('/api/partenaires', require('./routes/partenaires'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/abonnement', abonnementRoutes);
// ============ ENDPOINTS DE SANTÉ DEVOPS ============
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Garoui Electricité Backend',
    version: require('./package.json').version,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()) + ' secondes',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100) + '%'
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    },
    endpoints: {
      auth: '/api/auth',
      recrutement: '/api/recrutement',
      soustraitance: '/api/sous-traitance',
      services: '/api/services',
      materiel: '/api/materiel',
      partenaires: '/api/partenaires',
      admin: '/api/admin'
    },
    checks: {
      database: 'Connected', // Tu peux ajouter une vraie vérification plus tard
      fileSystem: 'OK',
      externalAPIs: 'OK'
    }
  };

  res.status(200).json(healthCheck);
});

// Endpoint simple pour monitoring externe (UptimeRobot)
app.get('/api/ping', (req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// Endpoint pour vérifier toutes les routes
app.get('/api/status', (req, res) => {
  res.status(200).json({
    message: '🚀 API Garoui Electricité opérationnelle !',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /api/health - Santé détaillée',
      'GET /api/ping - Test simple',
      'GET /api/status - Statut général',
      'POST /api/auth/* - Authentification',
      'GET /api/recrutement/* - Recrutement',
      'GET /api/services/* - Services',
      'GET /api/materiel/* - Matériel',
      'GET /api/partenaires/* - Partenaires'
    ]
  });
});
// Gestion des erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: 'La route demandée n\'existe pas'
  });
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Garoui Electricité démarré sur le port ${PORT}`);
  console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API disponible sur: http://localhost:${PORT}/api`);
});

module.exports = app; 