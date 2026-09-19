import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1_000_000 });

  app.register(helmet);
  app.register(cors, { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', service: 'marics-api' }));

  return app;
}