import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('health endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  it('reports service readiness without database access', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'marics-api' });
  });

  it('protects AI generation from unauthenticated callers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-scenario',
      payload: { moduleSlug: 'phishing', language: 'en' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it('protects scenario-specific explanations from unauthenticated callers', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/ai/scenario-why', payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it('does not expose a general security chat endpoint', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/ai/ask', payload: { prompt: 'How do I secure my account?' } });
    expect(response.statusCode).toBe(404);
  });

  it('requires authentication to view a personal certificate shelf', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/certificates' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it('rejects malformed public certificate verification IDs', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/certificates/verify/not-a-uuid' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('INVALID_VERIFICATION_ID');
  });

  it('requires authentication to update profile settings', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/users/me', payload: { fullName: 'New Name', preferredLanguage: 'en' } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it.each([
    ['GET', '/api/users/me'],
    ['GET', '/api/users/me/risk-profile'],
    ['GET', '/api/users/me/training-progress'],
  ])('protects personal security endpoint %s %s', async (method, url) => {
    const response = await app.inject({ method: method as 'GET', url });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it.each([
    ['GET', '/api/assessment/onboarding', undefined],
    ['GET', '/api/training/modules', undefined],
    ['GET', '/api/training/scenarios/whatsapp-gift-cards', undefined],
    ['POST', '/api/organizations', { name: 'Acme Security' }],
    ['POST', '/api/organizations/00000000-0000-0000-0000-000000000001/invitations', { email: 'employee@example.com' }],
    ['POST', '/api/organizations/invitations/accept', { token: 'a'.repeat(64) }],
    ['GET', '/api/organizations/00000000-0000-0000-0000-000000000001/dashboard', undefined],
    ['POST', '/api/organizations/00000000-0000-0000-0000-000000000001/reports', undefined],
  ])('protects organization endpoint %s %s', async (method, url, payload) => {
    const response = await app.inject({ method: method as 'GET' | 'POST', url, payload });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it.each([
    ['GET', '/api/admin/overview', undefined],
    ['GET', '/api/admin/users', undefined],
    ['GET', '/api/admin/organizations', undefined],
    ['GET', '/api/admin/training/catalog', undefined],
    ['GET', '/api/admin/analytics', undefined],
    ['GET', '/api/admin/audit-log', undefined],
    ['POST', '/api/admin/modules', { slug: 'test', title: 'Test', description: 'Test' }],
    ['PATCH', '/api/admin/modules/00000000-0000-0000-0000-000000000001', { published: true }],
    ['PATCH', '/api/admin/settings', { key: 'supported_languages', value: ['en'] }],
  ])('protects admin endpoint %s %s', async (method, url, payload) => {
    const response = await app.inject({ method: method as 'GET' | 'POST' | 'PATCH', url, payload });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });

  it('protects CSV organization reports', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/organizations/00000000-0000-0000-0000-000000000001/reports', payload: { format: 'csv' } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('AUTH_REQUIRED');
  });
});