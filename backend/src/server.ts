import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const port = Number(process.env.PORT ?? 4000);
console.info(`[config] invitation email: SUPABASE_URL=${process.env.SUPABASE_URL ? 'present' : 'missing'} SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing'}`);
const app = buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error, 'Unable to start API');
  process.exit(1);
}