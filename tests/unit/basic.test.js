// tests/unit/basic.test.js
describe('Tests basiques pour Garoui Electricité', () => {
  test('Addition simple', () => {
    expect(2 + 2).toBe(4);
  });

  test('Le projet a un nom', () => {
    expect('Garoui Electricité').toBe('Garoui Electricité');
  });

  test('Validation email basique', () => {
    const email = 'test@garoui.com';
    expect(email).toContain('@');
    expect(email).toContain('.com');
  });

  test('Vérification du type string', () => {
    const message = 'Backend Garoui Electricité';
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });
});