import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { z } from 'zod';
import { createAuthenticatedClient } from './lib/supabase.js';
import { assessmentSubmissionSchema, getOnboardingAssessment, submitAssessment } from './modules/assessments.js';
import { getScenario, getTrainingSummary, listPublishedModules, recordTrainingAnswer, trainingAnswerSchema } from './modules/training.js';
import { generateScenario, scenarioGenerationSchema } from './modules/ai.js';
import { acceptInvitation, acceptInvitationSchema, createInvitation, createOrganization, getInvitationByToken, getOrganizationDashboard, getOrganizationReport, listOrganizations, organizationSchema, organizationSettingsSchema, removeOrganizationMember, invitationSchema, updateOrganization } from './modules/organizations.js';
import {
  adminArchiveSchema,
  adminModuleSchema,
  adminScenarioSchema,
  adminModuleUpdateSchema,
  adminOrgAdminSchema,
  adminOrganizationSchema,
  adminPublishSchema,
  adminSettingSchema,
  adminSuspendSchema,
  adminUserRoleSchema,
  archiveAdminTrainingModule,
  createAdminModule,
  createAdminScenario,
  createAdminOrganization,
  getAdminOrganization,
  getAdminOverview,
  getAdminPlatformAnalytics,
  getAdminTrainingCatalog,
  getAdminUser,
  listAdminAuditLog,
  listAdminScenarios,
  requireMaricsAdmin,
  resendUserVerification,
  searchAdminOrganizations,
  searchAdminUsers,
  setAdminModulePublished,
  setAdminOrganizationAdmin,
  setAdminOrganizationSuspended,
  setAdminSetting,
  setAdminUserRole,
  setAdminUserSuspended,
  updateAdminTrainingModule,
} from './modules/admin.js';
import { getOrganizationReportCsv } from './modules/organizations.js';

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
  const productionOrigins = (process.env.FRONTEND_URL ?? process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const normalizeOriginPattern = (pattern: string) => pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  const isAllowedOrigin = (origin: string | undefined, patterns: string[]) => {
    if (!origin) return true;
    return patterns.some((pattern) => {
      if (pattern === origin) return true;
      const regex = new RegExp(`^${normalizeOriginPattern(pattern)}$`, 'i');
      return regex.test(origin);
    });
  };

  app.register(helmet);
  app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? (origin, callback) => {
          if (!origin || isAllowedOrigin(origin, productionOrigins)) {
            callback(null, true);
            return;
          }
          callback(new Error('Origin not allowed by CORS policy'), false);
        }
      : true,
    credentials: true,
  });
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
      const detail = error instanceof Error ? error.message : String(error);
      const migrationMissing = detail.includes('get_admin_overview') || detail.includes('PGRST202') || detail.includes('42883');
      return reply.code(500).send({
        error: 'ADMIN_UNAVAILABLE',
        message: migrationMissing ? 'The admin database migration is not applied. Apply 202609190008_admin_control_plane.sql, then retry.' : 'We could not load the admin dashboard.',
        details: process.env.NODE_ENV === 'production' ? undefined : detail,
      });
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
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_MODULE', message: 'Enter a valid module slug, title, and description.', details: error.issues.map((issue) => issue.path.join('.') || 'module').join(', ') });
      request.log.error(error, 'Admin module creation failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not create the module.' });
    }
  });

  app.post('/api/admin/scenarios', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.code(201).send({ scenario: await createAdminScenario(client, adminScenarioSchema.parse(request.body)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage scenarios.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_SCENARIO', message: 'Enter a scenario, exactly three options, and one correct answer.' });
      request.log.error(error, 'Admin scenario creation failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not create the scenario.' });
    }
  });

  app.get('/api/admin/modules/:moduleId/scenarios', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ scenarios: await listAdminScenarios(client, z.string().uuid().parse((request.params as { moduleId: string }).moduleId)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage scenarios.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_MODULE', message: 'Choose a valid module.' });
      request.log.error(error, 'Admin scenario list failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load module scenarios.' });
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

  app.get('/api/admin/users', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const query = z.object({ q: z.string().optional() }).parse(request.query);
      return reply.send({ users: await searchAdminUsers(client, query.q ?? '') });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage users.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin user search failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not search users.' });
    }
  });

  app.get('/api/admin/users/:userId', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ user: await getAdminUser(client, z.string().uuid().parse((request.params as { userId: string }).userId)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view this user.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin user lookup failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load the user record.' });
    }
  });

  app.patch('/api/admin/users/:userId/role', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const userId = z.string().uuid().parse((request.params as { userId: string }).userId);
      const input = adminUserRoleSchema.parse(request.body);
      return reply.send({ user: await setAdminUserRole(client, userId, input.role) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to update user roles.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ROLE', message: 'Choose a supported role.' });
      request.log.error(error, 'Admin user role update failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the user role.' });
    }
  });

  app.patch('/api/admin/users/:userId/suspended', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const userId = z.string().uuid().parse((request.params as { userId: string }).userId);
      const input = adminSuspendSchema.parse(request.body);
      return reply.send({ user: await setAdminUserSuspended(client, userId, input.suspended) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage user access.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_STATE', message: 'Provide a suspension state.' });
      request.log.error(error, 'Admin user suspension failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the user account.' });
    }
  });

  app.post('/api/admin/users/:userId/resend-verification', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await resendUserVerification(client, z.string().uuid().parse((request.params as { userId: string }).userId));
      return reply.code(202).send({ status: 'queued' });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to resend verification.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof Error && error.message === 'ADMIN_VERIFICATION_UNAVAILABLE') return reply.code(503).send({ error: 'VERIFICATION_UNAVAILABLE', message: 'Verification resend requires the Supabase service role on the API server.' });
      request.log.error(error, 'Admin verification resend failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not resend verification.' });
    }
  });

  app.get('/api/admin/organizations', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const query = z.object({ q: z.string().optional() }).parse(request.query);
      return reply.send({ organizations: await searchAdminOrganizations(client, query.q ?? '') });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage organizations.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin organization search failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not search organizations.' });
    }
  });

  app.get('/api/admin/organizations/:organizationId', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ organization: await getAdminOrganization(client, z.string().uuid().parse((request.params as { organizationId: string }).organizationId)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view this organization.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin organization lookup failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load the organization record.' });
    }
  });

  app.post('/api/admin/organizations', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.code(201).send({ organization: await createAdminOrganization(client, adminOrganizationSchema.parse(request.body).name) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to create organizations.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ORGANIZATION', message: 'Enter a valid organization name.' });
      request.log.error(error, 'Admin organization creation failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not create the organization.' });
    }
  });

  app.patch('/api/admin/organizations/:organizationId/suspended', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const organizationId = z.string().uuid().parse((request.params as { organizationId: string }).organizationId);
      return reply.send({ organization: await setAdminOrganizationSuspended(client, organizationId, adminSuspendSchema.parse(request.body).suspended) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage organizations.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin organization suspension failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the organization.' });
    }
  });

  app.patch('/api/admin/organizations/:organizationId/admins', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const organizationId = z.string().uuid().parse((request.params as { organizationId: string }).organizationId);
      const input = adminOrgAdminSchema.parse(request.body);
      await setAdminOrganizationAdmin(client, organizationId, input.userId, input.isAdmin);
      return reply.send({ status: 'updated' });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage organization admins.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ADMIN', message: 'Provide a valid organization admin assignment.' });
      request.log.error(error, 'Admin organization admin update failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the organization admin.' });
    }
  });

  app.get('/api/admin/training/catalog', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ catalog: await getAdminTrainingCatalog(client) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage training content.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin training catalog failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load the training catalog.' });
    }
  });

  app.patch('/api/admin/training/modules/:moduleId', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const moduleId = z.string().uuid().parse((request.params as { moduleId: string }).moduleId);
      return reply.send({ module: await updateAdminTrainingModule(client, moduleId, adminModuleUpdateSchema.parse(request.body)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage training modules.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_MODULE', message: 'Provide valid module content.' });
      request.log.error(error, 'Admin training module update failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not update the training module.' });
    }
  });

  app.patch('/api/admin/training/modules/:moduleId/archive', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const moduleId = z.string().uuid().parse((request.params as { moduleId: string }).moduleId);
      return reply.send({ module: await archiveAdminTrainingModule(client, moduleId, adminArchiveSchema.parse(request.body).archived) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage training modules.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin training module archive failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not archive the training module.' });
    }
  });

  app.get('/api/admin/analytics', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      return reply.send({ analytics: await getAdminPlatformAnalytics(client) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view analytics.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin analytics failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load platform analytics.' });
    }
  });

  app.get('/api/admin/audit-log', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const client = createAuthenticatedClient(auth.accessToken!);
      await requireMaricsAdmin(client);
      const query = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }).parse(request.query);
      return reply.send({ entries: await listAdminAuditLog(client, query.limit ?? 50) });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view the audit log.' });
      if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN', message: 'This area is restricted to MARICS administrators.' });
      request.log.error(error, 'Admin audit log failed');
      return reply.code(500).send({ error: 'ADMIN_UNAVAILABLE', message: 'We could not load the audit log.' });
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

  app.patch('/api/organizations/:organizationId', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const organizationId = (request.params as { organizationId: string }).organizationId;
      const input = organizationSettingsSchema.parse(request.body ?? {});
      const organization = await updateOrganization(createAuthenticatedClient(auth.accessToken!), organizationId, input);
      return reply.send({ organization });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to update this organization.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_ORGANIZATION_SETTINGS', message: 'Provide a valid organization name or language.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'You do not have permission to update this organization.' });
      request.log.error(error, 'Organization update failed');
      return reply.code(500).send({ error: 'ORGANIZATION_UNAVAILABLE', message: 'We could not update this organization.' });
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
      if (error instanceof Error && error.message === 'INVITATION_EMAIL_NOT_CONFIGURED') return reply.code(503).send({ error: 'INVITATION_EMAIL_NOT_CONFIGURED', message: 'Invitation email delivery is not configured on the server.' });
      if (error instanceof Error && error.message === 'INVITATION_EMAIL_FAILED') {
        const providerError = error.cause as { status?: number; name?: string; message?: string } | undefined;
        request.log.error({ provider: providerError }, 'Invitation email provider rejected delivery');
        return reply.code(502).send({ error: 'INVITATION_EMAIL_FAILED', message: providerError?.message ?? 'The invitation was created, but the email provider rejected delivery.', provider: providerError?.name ?? 'unknown_error', providerStatus: providerError?.status });
      }
      request.log.error(error, 'Invitation creation failed');
      return reply.code(500).send({ error: 'INVITATION_UNAVAILABLE', message: 'We could not create the invitation.' });
    }
  });

  app.get('/api/organizations/invitations/validate', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const token = z.string().regex(/^[a-f0-9]{64}$/i).parse((request.query as { token?: string })?.token);
      const invitation = await getInvitationByToken(createAuthenticatedClient(auth.accessToken!), token);
      return reply.send({ invitation });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to review this invitation.' });
      if (error instanceof z.ZodError || error instanceof Error && error.message.includes('INVITATION_INVALID')) return reply.code(400).send({ error: 'INVITATION_INVALID', message: 'This invitation is invalid, expired, or already used.' });
      request.log.error(error, 'Invitation validation failed');
      return reply.code(500).send({ error: 'INVITATION_UNAVAILABLE', message: 'We could not validate this invitation.' });
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

  app.delete('/api/organizations/:organizationId/members/:userId', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const organizationId = z.string().uuid().parse((request.params as { organizationId: string }).organizationId);
      const userId = z.string().uuid().parse((request.params as { userId: string }).userId);
      const result = await removeOrganizationMember(createAuthenticatedClient(auth.accessToken!), organizationId, userId);
      return reply.send({ member: result });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to manage organization employees.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_MEMBER', message: 'Choose a valid employee.' });
      if (error instanceof Error && error.message.includes('FORBIDDEN')) return reply.code(403).send({ error: 'FORBIDDEN', message: 'You do not have permission to manage this organization.' });
      request.log.error(error, 'Member removal failed');
      return reply.code(500).send({ error: 'ORGANIZATION_UNAVAILABLE', message: 'We could not remove this employee.' });
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
      const organizationId = (request.params as { organizationId: string }).organizationId;
      const format = z.object({ format: z.enum(['json', 'csv']).optional() }).parse(request.body ?? {});
      const client = createAuthenticatedClient(auth.accessToken!);
      if (format.format === 'csv') {
        const csv = await getOrganizationReportCsv(client, organizationId);
        return reply.code(201).type('text/csv').send(csv);
      }
      const report = await getOrganizationReport(client, organizationId);
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

  app.get('/api/assessment/onboarding', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const scenarios = await getOnboardingAssessment(createAuthenticatedClient(auth.accessToken!));
      return reply.send({ scenarios });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to start your assessment.' });
      request.log.error(error, 'Onboarding assessment lookup failed');
      return reply.code(500).send({ error: 'ASSESSMENT_UNAVAILABLE', message: 'We could not load the onboarding assessment.' });
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
      const { data, error } = await createAuthenticatedClient(auth.accessToken!).from('risk_profiles').select('strongest_dimension, focus_dimension, awareness_score, category_scores, updated_at').eq('user_id', auth.userId).maybeSingle();
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

  app.get('/api/training/modules', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const modules = await listPublishedModules(createAuthenticatedClient(auth.accessToken!));
      return reply.send({ modules });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view training modules.' });
      request.log.error(error, 'Training modules lookup failed');
      return reply.code(500).send({ error: 'TRAINING_MODULES_UNAVAILABLE', message: 'We could not load the available training modules.' });
    }
  });

  app.get('/api/training/scenarios/:scenarioSlug', async (request, reply) => {
    try {
      const auth = await requireUser(request);
      const scenarioSlug = z.string().regex(/^[a-z0-9-]+$/).parse((request.params as { scenarioSlug: string }).scenarioSlug);
      const scenario = await getScenario(createAuthenticatedClient(auth.accessToken!), scenarioSlug);
      return reply.send({ scenario });
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Please sign in to view this scenario.' });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_SCENARIO', message: 'Choose a valid training scenario.' });
      request.log.error(error, 'Training scenario lookup failed');
      return reply.code(404).send({ error: 'SCENARIO_NOT_FOUND', message: 'This training scenario is not available.' });
    }
  });

  return app;
}