export default async function globalTeardown() {
  if (globalThis.__E2E_FASTIFY__) {
    await globalThis.__E2E_FASTIFY__.close();
  }
}
