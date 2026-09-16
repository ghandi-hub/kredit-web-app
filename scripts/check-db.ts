import { connection } from '../src/lib/server/db';
import { DomainError } from '../src/lib/server/errors';

try {
  const c = await connection();
  try {
    await c.db.command({ ping: 1 });
    console.log('CONNECTED: Ping MongoDB berhasil.');
  } finally {
    await c.client.close();
  }
} catch (error) {
  if (error instanceof DomainError) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    console.error(`CONNECTION_FAILED: ${name}${typeof code === 'number' ? ` (code ${code})` : ''}`);
    if (code === 18)
      console.error('Autentikasi ditolak. Periksa username dan password database Atlas.');
  }
  process.exitCode = 1;
}
