// Dev helper: delete the SQLite database (and -wal/-shm). Refuses to run in production.
import { fileURLToPath } from 'node:url';
import { existsSync, rmSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = process.env;

if (env.NODE_ENV === 'production') {
  console.error('Refusing to reset the database: NODE_ENV=production.');
  process.exit(1);
}

const file = env.CHORELENGER_DB || `${root}data/chorelenger.db`;
let removed = 0;
for (const f of [file, `${file}-wal`, `${file}-shm`]) {
  if (existsSync(f)) {
    rmSync(f);
    removed++;
    console.log(`Removed ${f}`);
  }
}
if (!removed) console.log(`Nothing to remove (${file}).`);
