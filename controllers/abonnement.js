const db = require('../config/database');

// Souscrire à un abonnement
exports.souscrire = async (req, res) => {
  const { type } = req.body; // 'mois' ou 'trimestre'
  const userId = req.user.id;
  let duree;
  if (type === 'mois') duree = 30;
  else if (type === 'trimestre') duree = 90;
  else return res.status(400).json({ error: 'Type abonnement invalide' });

  const now = new Date();
  const fin = new Date(now.getTime() + duree * 24 * 60 * 60 * 1000);

  try {
    await db.query('INSERT INTO subscriptions (user_id, type, date_debut, date_fin, status) VALUES (?, ?, ?, ?, ?)', [userId, type, now, fin, 'active']);
    res.json({ message: 'Abonnement souscrit avec succès', type, date_fin: fin });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Consulter son abonnement
exports.monAbonnement = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY date_fin DESC LIMIT 1', [userId]);
    if (!rows.length) return res.json({ abonnement: null });
    res.json({ abonnement: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Annuler son abonnement
exports.annuler = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query('UPDATE subscriptions SET status = ? WHERE user_id = ? AND status = ?', ['cancelled', userId, 'active']);
    res.json({ message: 'Abonnement annulé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Liste des abonnements (admin)
exports.listeAbonnements = async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const [rows] = await db.query('SELECT * FROM subscriptions');
    res.json({ abonnements: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
