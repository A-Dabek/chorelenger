import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { buildApp } from './app.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = process.env;

let passwordHash = env.CHORELENGER_PASSWORD_HASH;
if (!passwordHash) {
  console.error('CHORELENGER_PASSWORD_HASH is not set. Generate one with: npm run hash-password -- <password>');
  process.exit(1);
}

const app = buildApp({
  db: openDb(env.CHORELENGER_DB || `${root}data/chorelenger.db`),
  passwordHash,
  secureCookies: env.COOKIE_SECURE === '1',
  webDir: `${root}web/dist`,
  logger: true,
});

const port = Number(env.PORT || 3000);
const host = env.HOST || '127.0.0.1';
app.listen({ port, host }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.close().then(() => process.exit(0)));
