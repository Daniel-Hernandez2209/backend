// tests/rateLimiter.test.js
const request = import('supertest');
const app = import('../app');

describe('Rate Limiter', () => {
  test('Debe permitir requests dentro del límite', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
    }
  });

  test('Debe bloquear después del límite', async () => {
    // Hacer 101 requests (límite es 100)
    for (let i = 0; i < 101; i++) {
      await request(app).get('/api/categories');
    }
    
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(429); // Too Many Requests
    expect(res.body.success).toBe(false);
  });

  test('Headers de rate limit deben estar presentes', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });
});