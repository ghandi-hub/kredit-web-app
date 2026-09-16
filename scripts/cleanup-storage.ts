import { connection } from '../src/lib/server/db';
import { processStorageCleanup } from '../src/lib/server/storage-cleanup';

try {
  await processStorageCleanup(undefined, 100);
  const c = await connection();
  const remaining = await c.db.collection('storage_cleanup').countDocuments();
  console.log(`Storage cleanup selesai. Antrean tersisa: ${remaining}.`);
  if (remaining) process.exitCode = 1;
} catch {
  console.error('Storage cleanup gagal. Periksa koneksi MongoDB dan Cloudinary.');
  process.exitCode = 1;
} finally {
  try {
    const c = await connection();
    await c.client.close();
  } catch {
    // Connection may not have been established.
  }
}
