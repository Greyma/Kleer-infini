const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token d\'accès requis',
      message: 'Veuillez fournir un token d\'authentification'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier que l'utilisateur existe toujours en base
    const [user] = await query(
      'SELECT id, email, role, status FROM users WHERE id = ? AND status = "active"',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Token invalide',
        message: 'Utilisateur non trouvé ou désactivé'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré',
        message: 'Votre session a expiré, veuillez vous reconnecter'
      });
    }
    
    return res.status(403).json({
      error: 'Token invalide',
      message: 'Token d\'authentification invalide'
    });
  }
};

// Middleware pour vérifier les rôles
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      // Si req.user n'est pas encore défini, tenter d'hydrater depuis le token
      if (!req.user) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [user] = await query(
              'SELECT id, email, role, status FROM users WHERE id = ? AND status = "active"',
              [decoded.userId]
            );
            if (user) {
              req.user = user;
            }
          } catch (e) {
            // Ignorer ici, on tombera sur l'erreur 401 plus bas
          }
        }
      }

      if (!req.user) {
        return res.status(401).json({
          error: 'Authentification requise',
          message: 'Vous devez être connecté pour accéder à cette ressource'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Accès refusé',
          message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource'
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({
        error: 'Erreur serveur',
        message: 'Erreur lors de la vérification des permissions'
      });
    }
  };
};

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = requireRole(['admin']);

// Middleware pour vérifier si l'utilisateur est admin ou modérateur
const requireAdminOrModerator = requireRole(['admin', 'moderator']);

// Middleware pour vérifier si l'utilisateur est client
const requireClient = requireRole(['client']);

// Middleware pour vérifier si l'utilisateur est partenaire
const requirePartner = requireRole(['partner']);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireAdminOrModerator,
  requireClient,
  requirePartner
}; 