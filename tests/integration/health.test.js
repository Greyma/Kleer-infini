const request = require('supertest');
const app = require('../../server');

describe('🏥 Tests endpoints de santé - DevOps', () => {
  
  test('GET /api/health - Endpoint de santé détaillé', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    // Vérifications de la structure
    expect(response.body).toHaveProperty('status', 'UP');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('service');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('endpoints');

    // Vérifications spécifiques
    expect(response.body.service).toBe('Garoui Electricité Backend');
    expect(response.body.endpoints).toHaveProperty('auth', '/api/auth');
    expect(response.body.endpoints).toHaveProperty('services', '/api/services');
    
    console.log('✅ Endpoint /api/health fonctionne correctement');
  });

  test('GET /api/ping - Test simple monitoring', async () => {
    const response = await request(app)
      .get('/api/ping')
      .expect(200);

    expect(response.body).toHaveProperty('message', 'pong');
    expect(response.body).toHaveProperty('timestamp');
    
    console.log('✅ Endpoint /api/ping répond correctement');
  });

  test('GET /api/status - Statut général API', async () => {
    const response = await request(app)
      .get('/api/status')
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('opérationnelle');
    expect(response.body).toHaveProperty('availableEndpoints');
    expect(Array.isArray(response.body.availableEndpoints)).toBe(true);
    
    console.log('✅ Endpoint /api/status liste les routes correctement');
  });

  test('Vérification temps de réponse < 500ms', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/ping')
      .expect(200);
      
    const responseTime = Date.now() - start;
    expect(responseTime).toBeLessThan(500);
    
    console.log(`✅ Temps de réponse: ${responseTime}ms (< 500ms)`);
  });

});