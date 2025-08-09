// Configuration de l'environnement de test
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;

// Mock des variables d'environnement pour les tests
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';
process.env.JWT_SECRET = 'test_secret_key_for_testing';

// Configuration timeout pour les tests
jest.setTimeout(30000);

// Fonction de nettoyage après les tests
afterAll(async () => {
  // Fermer les connexions ouvertes
  if (global.server) {
    await global.server.close();
  }
  
  // Attendre un peu avant de fermer Jest
  await new Promise(resolve => setTimeout(resolve, 500));
});

console.log('🧪 Environnement de test configuré');