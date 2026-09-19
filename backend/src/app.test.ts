import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('health endpoint', () => {
  it('reports service readiness without database access', async () => {
    const response = await buildApp().inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'marics-api' });
  });

  it('protects AI generation from unauthenticated callers', async () => {
    const response = await buildApp().inject({
      method: 'POST',
      url: '/api/ai/generate-scenario',
      payload: { moduleSlug: 'phishing', language: 'en' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });
});