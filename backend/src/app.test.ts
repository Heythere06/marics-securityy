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

  it.each([
    ['GET', '/api/training/modules', undefined],
    ['GET', '/api/training/scenarios/whatsapp-gift-cards', undefined],
    ['POST', '/api/organizations', { name: 'Acme Security' }],
    ['POST', '/api/organizations/00000000-0000-0000-0000-000000000001/invitations', { email: 'employee@example.com' }],
    ['POST', '/api/organizations/invitations/accept', { token: 'a'.repeat(64) }],
    ['GET', '/api/organizations/00000000-0000-0000-0000-000000000001/dashboard', undefined],
    ['POST', '/api/organizations/00000000-0000-0000-0000-000000000001/reports', undefined],
  ])('protects organization endpoint %s %s', async (method, url, payload) => {
    const response = await buildApp().inject({ method: method as 'GET' | 'POST', url, payload });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it.each([
    ['GET', '/api/admin/overview', undefined],
    ['POST', '/api/admin/modules', { slug: 'test', title: 'Test', description: 'Test' }],
    ['PATCH', '/api/admin/modules/00000000-0000-0000-0000-000000000001', { published: true }],
    ['PATCH', '/api/admin/settings', { key: 'supported_languages', value: ['en'] }],
  ])('protects admin endpoint %s %s', async (method, url, payload) => {
    const response = await buildApp().inject({ method: method as 'GET' | 'POST' | 'PATCH', url, payload });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });
});