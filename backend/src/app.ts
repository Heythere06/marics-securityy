import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z } from 'zod';
import { createAuthenticatedClient } from './lib/supabase.js';
import { assessmentSubmissionSchema, submitAssessment } from './modules/assessments.js';

type AuthenticatedRequest = { userId?: string; accessToken?: string };

async function requireUser(request: { headers: Record<string, string | string[] | undefined> }): Promise<AuthenticatedRequest> {
  const header = request.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('AUTH_REQUIRED');
  const { data, error } = await createAuthenticatedClient(token).auth.getUser(token);
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  return { userId: data.user.id, accessToken: token };
}

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1_000_000 });

  app.register(helmet);
  app.register(cors, { origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL ?? 'http://localhost:5173') : true });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', service: 'marics-api' }));

  app.post('/api/assessments', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const input = assessmentSubmissionSchema.parse(request.body);
      const userClient = createAuthenticatedClient(auth.accessToken!);
      const { data } = await userClient.auth.getUser(auth.accessToken);
      const profile = await submitAssessment(userClient, data.user!, input);
      return reply.code(201).send({ profile });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to submit your assessment.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ASSESSMENT', message: 'Please complete every assessment question.' });
      request.log.error(error, 'Assessment submission failed');
      return reply.code(500).send({ error: 'ASSESSMENT_UNAVAILABLE', message: 'We could not save your assessment. Please try again.' });
    }
  });

  app.get('/api/users/me/risk-profile', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const { data, error } = await createAuthenticatedClient(auth.accessToken!).from('risk_profiles').select('strongest_dimension, focus_dimension, awareness_score, updated_at').eq('user_id', auth.userId).maybeSingle();
      if (error) throw error;
      return reply.send({ profile: data });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view your risk profile.' });
      request.log.error(error, 'Risk profile lookup failed');
      return reply.code(500).send({ error: 'RISK_PROFILE_UNAVAILABLE', message: 'We could not load your risk profile.' });
    }
  });

  app.get('/api/users/me', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const { data, error } = await createAuthenticatedClient(auth.accessToken!).from('profiles').select('id, full_name, preferred_language, role').eq('id', auth.userId).maybeSingle();
      if (error) throw error;
      return reply.send({ profile: data });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view your profile.' });
      request.log.error(error, 'Profile lookup failed');
      return reply.code(500).send({ error: 'PROFILE_UNAVAILABLE', message: 'We could not load your profile.' });
    }
  });

  return app;
}