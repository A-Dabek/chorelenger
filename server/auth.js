import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha = (t) => createHash('sha256').update(t).digest('hex');
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function createSession(db) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').run(
    sha(token),
    Date.now() + SESSION_TTL_MS,
  );
  return token;
}

export function checkSession(db, token) {
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(sha(token));
  return !!row && row.expires_at > Date.now();
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

/** In-memory login throttle: max `limit` failures per `windowMs` per key. */
export function createThrottle(limit = 5, windowMs = 15 * 60 * 1000) {
  const hits = new Map();
  const fresh = (key) => (hits.get(key) || []).filter((t) => t > Date.now() - windowMs);
  return {
    blocked: (key) => fresh(key).length >= limit,
    fail: (key) => hits.set(key, [...fresh(key), Date.now()]),
    reset: (key) => hits.delete(key),
  };
}
