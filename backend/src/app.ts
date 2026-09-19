import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z } from 'zod';
import { createAuthenticatedClient } from './lib/supabase.js';
import { assessmentSubmissionSchema, submitAssessment } from './modules/assessments.js';
import { getTrainingSummary, recordTrainingAnswer, trainingAnswerSchema } from './modules/training.js';
import { generateScenario, scenarioGenerationSchema } from './modules/ai.js';
import { acceptInvitation, acceptInvitationSchema, createInvitation, createOrganization, invitationSchema, getOrganizationDashboard, getOrganizationReport, listOrganizations, organizationSchema } from './modules/organizations.js';
import { adminModuleSchema, adminPublishSchema, adminSettingSchema, createAdminModule, getAdminOverview, requireMaricsAdmin, setAdminModulePublished, setAdminSetting } from './modules/admin.js';

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

  app.get('/api/admin/overview', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ overview: await getAdminOverview(client) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to access the MARICS admin dashboard.' });
      if (error instanceof Error && (error.message === 'ADMIN_FORBIDDEN' || error.message.includes('FORBIDDEN'))) return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin overview failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load the admin dashboard.' });
    }
  });

  app.post('/api/admin/modules', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.code(201).send({ module: await createAdminModule(client, adminModuleSchema.parse(request.body)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage modules.' });
      if (error instanceof Error && (error.message === 'ADMIN_FORBIDDEN' || error.message.includes('FORBIDDEN'))) return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_MODULE', message: 'Enter a valid module slug, title, and description.' });
      request.log.error(error, 'Admin module creation failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not create the module.' });
    }
  });

  app.patch('/api/admin/modules/:moduleId', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const input = adminPublishSchema.parse(request.body);
      return reply.send({ module: await setAdminModulePublished(client, (request.params as { moduleId: string }).moduleId, input.published) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage modules.' });
      if (error instanceof Error && (error.message === 'ADMIN_FORBIDDEN' || error.message.includes('FORBIDDEN'))) return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_MODULE', message: 'Provide a valid publication state.' });
      request.log.error(error, 'Admin module update failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the module.' });
    }
  });

  app.patch('/api/admin/settings', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ setting: await setAdminSetting(client, adminSettingSchema.parse(request.body)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage platform settings.' });
      if (error instanceof Error && (error.message === 'ADMIN_FORBIDDEN' || error.message.includes('FORBIDDEN'))) return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_SETTING', message: 'Provide supported platform languages.' });
      request.log.error(error, 'Admin setting update failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the platform setting.' });
    }
  });

  app.post('/api/organizations', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const organization = await createOrganization(createAuthenticatedClient(auth.accessToken!), organizationSchema.parse(request.body));
      return reply.code(201).send({ organization });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to create an organization.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ORGANIZATION', message: 'Enter an organization name between 2 and 180 characters.' });
      request.log.error(error, 'Organization creation failed');
      return reply.code(500).send({ error: 'ORGANIZATION_UNAVAILABLE', message: 'We could not create the organization.' });
    }
  });

  app.get('/api/organizations', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const organizations = await listOrganizations(createAuthenticatedClient(auth.accessToken!));
      return reply.send({ organizations });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view your organizations.' });
      request.log.error(error, 'Organization list failed');
      return reply.code(500).send({ error: 'ORGANIZATION_UNAVAILABLE', message: 'We could not load your organizations.' });
    }
  });

  app.post('/api/organizations/:organizationId/invitations', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const input = invitationSchema.parse(request.body);
      const invitation = await createInvitation(createAuthenticatedClient(auth.accessToken!), (request.params as { organizationId: string }).organizationId, input.email);
      return reply.code(201).send({ invitation });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to invite an employee.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_INVITATION', message: 'Enter a valid employee email address.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'You do not have permission to invite employees to this organization.' });
      request.log.error(error, 'Invitation creation failed');
      return reply.code(500).send({ error: 'INVITATION_UNAVAILABLE', message: 'We could not create the invitation.' });
    }
  });

  app.post('/api/organizations/invitations/accept', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const input = acceptInvitationSchema.parse(request.body);
      const result = await acceptInvitation(createAuthenticatedClient(auth.accessToken!), input.token);
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in before accepting an invitation.' });
      if (error instanceof z.ZodError || (error instanceof Error && error.message.includes('INVITATION_INVALID'))) return reply.code(400).send({ error: 'INVITATION_INVALID', message: 'This invitation is invalid or has expired.' });
      request.log.error(error, 'Invitation acceptance failed');
      return reply.code(500).send({ error: 'INVITATION_UNAVAILABLE', message: 'We could not accept the invitation.' });
    }
  });

  app.get('/api/organizations/:organizationId/dashboard', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const dashboard = await getOrganizationDashboard(createAuthenticatedClient(auth.accessToken!), (request.params as { organizationId: string }).organizationId);
      return reply.send({ dashboard });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view organization data.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'You do not have permission to view this organization.' });
      request.log.error(error, 'Organization dashboard failed');
      return reply.code(500).send({ error: 'ORGANIZATION_UNAVAILABLE', message: 'We could not load the organization dashboard.' });
    }
  });

  app.post('/api/organizations/:organizationId/reports', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const report = await getOrganizationReport(createAuthenticatedClient(auth.accessToken!), (request.params as { organizationId: string }).organizationId);
      return reply.code(201).send({ report });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to generate organization reports.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'You do not have permission to generate this report.' });
      request.log.error(error, 'Organization report failed');
      return reply.code(500).send({ error: 'REPORT_UNAVAILABLE', message: 'We could not generate the organization report.' });
    }
  });

  app.post('/api/ai/generate-scenario', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const input = scenarioGenerationSchema.parse(request.body);
      const userClient = createAuthenticatedClient(auth.accessToken!);
      const { data } = await userClient.auth.getUser(auth.accessToken);
      const scenario = await generateScenario(userClient, data.user!, input);
      return reply.code(201).send({ scenario });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to generate training content.' });
      if (error instanceof Error && error.message === 'AI_NOT_CONFIGURED') return reply.code(503).send({ error: 'AI_UNAVAILABLE', message: 'AI scenario generation is not configured.' });
      if (error instanceof z.ZodError || error instanceof SyntaxError) return reply.code(502).send({ error: 'AI_INVALID_OUTPUT', message: 'The generated scenario could not be validated. Please try again.' });
      request.log.error(error, 'AI scenario generation failed');
      return reply.code(503).send({ error: 'AI_UNAVAILABLE', message: 'We could not generate a scenario right now. Please try again later.' });
    }
  });

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
      const { data, error } = await createAuthenticatedClient(auth.accessToken!).from('profiles').select('id, full_name, preferred_language, role, account_type, country_code').eq('id', auth.userId).maybeSingle();
      if (error) throw error;
      return reply.send({ profile: data });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view your profile.' });
      request.log.error(error, 'Profile lookup failed');
      return reply.code(500).send({ error: 'PROFILE_UNAVAILABLE', message: 'We could not load your profile.' });
    }
  });

  app.patch('/api/users/me', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const input = z.object({ preferredLanguage: z.enum(['en', 'af', 'pt']) }).parse(request.body);
      const { data, error } = await createAuthenticatedClient(auth.accessToken!).from('profiles').update({ preferred_language: input.preferredLanguage, updated_at: new Date().toISOString() }).eq('id', auth.userId).select('preferred_language').single();
      if (error) throw error;
      return reply.send({ profile: data });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to update your settings.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_LANGUAGE', message: 'Choose a supported language.' });
      request.log.error(error, 'Profile update failed');
      return reply.code(500).send({ error: 'PROFILE_UNAVAILABLE', message: 'We could not update your settings.' });
    }
  });

  app.post('/api/scenarios/:scenarioSlug/answer', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const input = trainingAnswerSchema.parse(request.body);
      const userClient = createAuthenticatedClient(auth.accessToken!);
      const { data } = await userClient.auth.getUser(auth.accessToken);
      const result = await recordTrainingAnswer(userClient, data.user!, (request.params as { scenarioSlug: string }).scenarioSlug, input);
      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to save training progress.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ANSWER', message: 'Choose one of the available responses.' });
      request.log.error(error, 'Training answer failed');
      return reply.code(500).send({ error: 'TRAINING_UNAVAILABLE', message: 'We could not save this training attempt.' });
    }
  });

  app.get('/api/users/me/training-progress', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const summary = await getTrainingSummary(createAuthenticatedClient(auth.accessToken!), auth.userId!);
      return reply.send(summary);
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view training progress.' });
      request.log.error(error, 'Training progress lookup failed');
      return reply.code(500).send({ error: 'TRAINING_PROGRESS_UNAVAILABLE', message: 'We could not load your training progress.' });
    }
  });

  return app;
}