import { ObjectId } from 'mongodb';
import { connection } from '../src/lib/server/db';
import { backupToTelegram, getBackupStatus } from '../src/lib/server/backup';

console.log('Memeriksa status cadangan database...');
const status = await getBackupStatus();
if (status.lastBackupAt) {
  console.log(`Cadangan terakhir: ${status.lastBackupAt} (${status.daysAgo} hari yang lalu)`);
} else {
  console.log('Database belum pernah dicadangkan ke Telegram.');
}

console.log('Memulai proses cadangan database ke Telegram...');
const c = await connection();
try {
  const admin = await c.users.findOne({});
  const actorId = admin?._id || new ObjectId();
  const result = await backupToTelegram(actorId);
  console.log('BERHASIL: Cadangan database berhasil dikirim ke Telegram!');
  console.log(`- Berkas: ${result.fileName}`);
  console.log(`- Ukuran: ${result.sizeKb} KB`);
  console.log('- Ringkasan data:', result.summary);
} catch (error) {
  console.error('GAGAL: Proses cadangan database ke Telegram tidak berhasil.');
  if (error instanceof Error) {
    console.error(`- Rincian: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  await c.client.close();
}
