import { hashPassword } from './auth.js';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('Usage: npm run hash-password -- <password (min 8 chars)>');
  process.exit(1);
}
console.log(`CHORELENGER_PASSWORD_HASH='${hashPassword(pw)}'`);
