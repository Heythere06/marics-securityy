import 'dotenv/config';
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const app = buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error, 'Unable to start API');
  process.exit(1);
}