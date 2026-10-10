import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { execSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

let appInstance = null;

export default async function globalSetup() {
  // Build frontend static bundle
  execSync('npm run build', { stdio: 'inherit' });

  appInstance = buildApp({
    db: openDb(`${root}data/e2e-test.db`),
    passwordHash: 'scrypt$ecc8f00ee33e4c489ba401d13adbd70e$4eee74105844fa4909c3c4ab0e75c99b33c5cf2b6b2004163ad8d60c9533cc6c11b6b4898306d6fe67110ed17ab19745d2ae56b3fde8256c796e3ed14f01ab05',
    secureCookies: false,
    webDir: `${root}web/dist`,
    logger: false,
  });

  await appInstance.listen({ port: 3100, host: '127.0.0.1' });
  globalThis.__E2E_FASTIFY__ = appInstance;
}
