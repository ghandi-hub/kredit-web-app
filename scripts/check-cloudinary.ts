import assert from 'node:assert/strict';
import { storage } from '../src/lib/server/storage';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5b8AAAAASUVORK5CYII=',
  'base64',
);
let key: string | undefined;
let stage = 'UPLOAD';
try {
  const photo = await storage.upload(new File([png], 'connection-test.png', { type: 'image/png' }));
  key = photo.storageKey;
  console.log('PASS: Upload gambar uji ke Cloudinary.');

  stage = 'DOWNLOAD';
  const downloaded = await storage.get(key);
  // Cloudinary may re-encode images; verify PNG signature, IHDR and dimensions.
  assert.ok(downloaded.length > 24);
  assert.deepEqual(downloaded.subarray(0, 24), png.subarray(0, 24));
  console.log('PASS: Download privat menghasilkan PNG dengan dimensi yang sesuai (1 x 1).');

  stage = 'PRIVATE_ACCESS';
  const cloud = encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME!);
  const response = await fetch(
    `https://res.cloudinary.com/${cloud}/image/authenticated/kredit/ktp/${key}`,
    { signal: AbortSignal.timeout(30000) },
  );
  await response.body?.cancel();
  assert.ok([401, 403, 404].includes(response.status));
  console.log(`PASS: Akses tanpa signature ditolak (HTTP ${response.status}).`);
} catch (error) {
  console.error(`ERROR_TYPE: ${error instanceof Error ? error.name : 'ProviderError'}`);
  const status =
    error && typeof error === 'object' && 'http_code' in error ? error.http_code : undefined;
  console.error(`FAIL: ${stage}${typeof status === 'number' ? ` (HTTP ${status})` : ''}.`);
  process.exitCode = 1;
} finally {
  if (key) {
    try {
      await storage.delete(key);
      console.log('PASS: Gambar uji telah dihapus dari Cloudinary.');
    } catch {
      console.error(`FAIL: Hapus gambar uji gagal. Storage key: ${key}`);
      process.exitCode = 1;
    }
  }
}
