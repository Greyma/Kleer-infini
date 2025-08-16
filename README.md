# 🏢 Backend Garoui Electricité

Backend complet pour l'application web Garoui Electricité avec gestion des recrutements, sous-traitance, services clients, catalogue matériel et partenaires.

## 🚀 Fonctionnalités
### 1. Espace Recrutement & Stage
- ✅ API RESTful pour gestion des candidatures (CRUD)
- ✅ Stockage sécurisé des CV, diplômes et documents (AWS S3)
- ✅ Système de validation et modération par administrateur
- ✅ Gestion des rôles et permissions

### 2. Espace Sous-traitance
- ✅ Gestion des profils entreprise (inscription, upload documents)
- ✅ Workflow de validation administrateur
- ✅ Base de données avec classification des entreprises par région/type
- ✅ API sécurisée pour modification des profils

### 3. Espace Client & Services
- ✅ Gestion du catalogue des services (CRUD)
- ✅ Module demande de devis avec suivi
- ✅ Historique des demandes client
- ✅ Authentification client sécurisée

### 4. Catalogue Matériel Électrique
- ✅ Base produit avec catégories et filtres
- ✅ Gestion des stocks et disponibilités
- ✅ Interface d'upload/modification produits pour admin
- ✅ API pour consultation publique

### 5. Espace Partenaires
- ✅ Gestion des fiches partenaires (CRUD)
- ✅ Association des partenaires à catégories/services
- ✅ Interface d'administration pour ajout/suppression

### 6. Système d'abonnement
- ✅ Abonnement mensuel et trimestriel pour les utilisateurs
- ✅ Gestion des paiements et renouvellements
- ✅ API pour souscrire, consulter et annuler un abonnement
- ✅ Notifications de renouvellement et expiration

## 🛠️ Technologies utilisées

- **Backend**: Node.js avec Express.js
- **Base de données**: MySQL
- **Authentification**: JWT (JSON Web Tokens)
- **Stockage fichiers**: AWS S3
- **Validation**: Express-validator
- **Sécurité**: Helmet, CORS, Rate limiting
- **Hachage**: bcryptjs

## 📋 Prérequis

- Node.js (version 16 ou supérieure)
- MySQL (version 8.0 ou supérieure)
- Compte AWS avec accès S3 (optionnel pour le stockage de fichiers)

- Table MySQL subscriptions :
  - id INT AUTO_INCREMENT PRIMARY KEY
  - user_id INT NOT NULL
  - type ENUM('mois','trimestre') NOT NULL
  - date_debut DATETIME NOT NULL
  - date_fin DATETIME NOT NULL
  - status ENUM('active','cancelled','expired') DEFAULT 'active'

## 🔧 Installation

### 1. Cloner le projet
```bash
git clone <url-du-repo>
cd garoui-electricite-backend
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de l'environnement
```bash
# Copier le fichier d'exemple
cp env.example .env

# Éditer le fichier .env avec vos paramètres
```

### 4. Configuration de la base de données
```bash
# Créer la base de données MySQL
mysql -u root -p
CREATE DATABASE garoui_electricite CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Migration et seeding
```bash
# Créer les tables
npm run migrate

# Créer la table des abonnements
node scripts/migrate_subscription.js

# Ajouter les données de test
npm run seed
```

### 6. Démarrer le serveur
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 🔐 Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Configuration du serveur
PORT=3000
NODE_ENV=development

# Configuration de la base de données MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=garoui_electricite

# Configuration JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Configuration AWS S3 pour le stockage des fichiers
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=eu-west-3
AWS_S3_BUCKET=garoui-electricite-files

# Configuration email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# Configuration de sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentification
Toutes les routes protégées nécessitent un token JWT dans le header :
```
Authorization: Bearer <token>
```

### Routes principales
#### 💳 Abonnement
- `POST /abonnement/souscrire` - Souscrire à un abonnement (mensuel ou trimestriel)
- `GET /abonnement/mon-abonnement` - Consulter l'état de son abonnement
- `POST /abonnement/annuler` - Annuler son abonnement
- `GET /abonnement/admin/abonnements` - Liste des abonnements (admin)

#### 🔐 Authentification
- `POST /auth/register` - Inscription utilisateur
- `POST /auth/login` - Connexion utilisateur
- `GET /auth/profile` - Profil utilisateur
- `PUT /auth/profile` - Mise à jour profil
- `PUT /auth/change-password` - Changer mot de passe

#### 👥 Recrutement
- `POST /recrutement/candidature` - Soumettre une candidature
- `GET /recrutement/mes-candidatures` - Mes candidatures
- `GET /recrutement/admin/candidatures` - Toutes les candidatures (admin)
- `PUT /recrutement/admin/candidature/:id/status` - Modifier statut candidature

#### 🏢 Sous-traitance
- `POST /sous-traitance/entreprise` - Créer profil entreprise
- `GET /sous-traitance/mon-entreprise` - Mon profil entreprise
- `GET /sous-traitance/admin/entreprises` - Toutes les entreprises (admin)
- `GET /sous-traitance/recherche` - Rechercher entreprises

#### 🛠️ Services
- `GET /services/catalogue` - Catalogue des services
- `POST /services/devis` - Demander un devis
- `GET /services/mes-devis` - Mes devis
- `GET /services/admin/devis` - Tous les devis (admin)

#### 📦 Matériel
- `GET /materiel/produits` - Catalogue des produits
- `GET /materiel/categories` - Catégories de produits
- `GET /materiel/marques` - Marques de produits
- `POST /materiel/produits` - Créer produit (admin)
- `PUT /materiel/produits/:id` - Modifier produit (admin)

#### 🤝 Partenaires
- `GET /partenaires/partenaires` - Liste des partenaires
- `GET /partenaires/categories` - Catégories de partenaires
- `POST /partenaires/partenaires` - Créer partenaire (admin)
- `PUT /partenaires/partenaires/:id` - Modifier partenaire (admin)

#### 👨‍💼 Administration
- `GET /admin/dashboard` - Tableau de bord
- `GET /admin/users` - Gestion utilisateurs
- `GET /admin/reports/candidatures` - Rapports candidatures
- `GET /admin/reports/devis` - Rapports devis

## 👥 Rôles utilisateurs

- **client** : Accès aux services et devis
- **partner** : Accès à l'espace sous-traitance
- **candidat** : Accès à l'espace recrutement
- **moderator** : Modération des contenus
- **admin** : Accès complet à toutes les fonctionnalités

## 🧪 Tests

```bash
# Lancer les tests
npm test
```

## 📊 Comptes de test

Après avoir exécuté le seeding, les comptes suivants sont disponibles :

- **Admin**: `admin@garoui-electricite.com` / `admin123`
- **Modérateur**: `moderator@garoui-electricite.com` / `moderator123`
- **Client**: `client@test.com` / `client123`
- **Partenaire**: `partenaire@test.com` / `partenaire123`
- **Candidat**: `candidat@test.com` / `candidat123`

## 🔒 Sécurité

- Authentification JWT
- Hachage des mots de passe avec bcrypt
- Rate limiting pour prévenir les attaques
- Validation des données avec express-validator
- Headers de sécurité avec Helmet
- CORS configuré
- Stockage sécurisé des fichiers sur AWS S3

## 📁 Structure du projet

```
garoui-electricite-backend/
├── config/
│   └── database.js          # Configuration base de données
├── middleware/
│   └── auth.js              # Middleware d'authentification
├── routes/
│   ├── auth.js              # Routes d'authentification
│   ├── recrutement.js       # Routes recrutement
│   ├── sous-traitance.js    # Routes sous-traitance
│   ├── services.js          # Routes services
│   ├── materiel.js          # Routes matériel
│   ├── partenaires.js       # Routes partenaires
│   └── admin.js             # Routes administration
├── scripts/
│   ├── migrate.js           # Script de migration
│   └── seed.js              # Script de seeding
├── utils/
│   └── upload.js            # Utilitaires upload fichiers
├── server.js                # Point d'entrée
├── package.json
└── README.md
```

## 🚀 Déploiement

### Production
```bash
# Installer les dépendances de production
npm ci --only=production

# Démarrer le serveur
NODE_ENV=production npm start
```

### Docker (optionnel)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📞 Support

Pour toute question ou problème, contactez l'équipe de développement.

## 📄 Licence

Ce projet est sous licence MIT.

---

**Garoui Electricité** - Backend API v1.0.0 

## 🎉 Tests automatiques configurés !
DevOps pipeline fonctionnel avec GitHub Actions !