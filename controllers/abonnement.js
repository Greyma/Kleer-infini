const db = require('../config/database');

// Souscrire à un abonnement
exports.souscrire = async (req, res) => {
  // Accept { plan: 'mensuel' | 'trimestriel' }
  const { plan } = req.body;
  const userId = req.user.id;
  let duree;
  if (plan === 'mensuel') duree = 30;
  else if (plan === 'trimestriel') duree = 90;
  else return res.status(400).json({ message: 'Plan invalide' });

  const now = new Date();
  const fin = new Date(now.getTime() + duree * 24 * 60 * 60 * 1000);

  try {
    const result = await db.query(
      'INSERT INTO subscriptions (user_id, type, plan, date_debut, date_fin, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, plan === 'mensuel' ? 'mois' : 'trimestre', plan, now, fin, 'active']
    );
    res.status(201).json({
      id: result.insertId,
      userId,
      plan,
      status: 'active',
      startsAt: now.toISOString(),
      endsAt: fin.toISOString()
    });
  } catch (err) {
    console.error('Erreur souscription:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Consulter son abonnement
exports.monAbonnement = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query('SELECT status, date_debut, date_fin FROM subscriptions WHERE user_id = ? ORDER BY date_fin DESC LIMIT 1', [userId]);
    if (!rows.length) return res.json({ status: 'free' });
    const sub = rows[0];
    const now = new Date();
    const ends = new Date(sub.date_fin);
    const payload = {
      status: 'free',
      startsAt: new Date(sub.date_debut).toISOString(),
      endsAt: ends.toISOString()
    };
    if (sub.status === 'active' && ends > now) payload.status = 'premium';
    else if (ends <= now) payload.status = 'expired';
    return res.json(payload);
  } catch (err) {
    console.error('Erreur monAbonnement:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Annuler son abonnement
exports.annuler = async (req, res) => {
  const userId = req.user.id;
  try {
    const now = new Date();
    await db.query('UPDATE subscriptions SET status = ?, canceled_at = ? WHERE user_id = ? AND status = ?', ['cancelled', now, userId, 'active']);
    res.status(204).send();
  } catch (err) {
    console.error('Erreur annulation abonnement:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Liste des abonnements (admin)

exports.listeAbonnements = async (req, res) => {
  if (req.user.role === 'admin') {
    // Admin : accès à tous les abonnements
    try {
      const [rows] = await db.query('SELECT * FROM subscriptions');
      res.json({ abonnements: rows });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } else if (req.user.role === 'sous-traitant' || req.user.role === 'partner') {
    // Sous-traitant : accès uniquement à ses propres abonnements
    try {
      const [rows] = await db.query('SELECT * FROM subscriptions WHERE user_id = ?', [req.user.id]);
      res.json({ abonnements: rows });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } else {
    return res.status(403).json({ error: 'Accès refusé' });
  }
};
