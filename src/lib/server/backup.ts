import { gzipSync } from 'node:zlib';
import type { ObjectId } from 'mongodb';
import { connection, audit } from './db';
import { DomainError } from './errors';
import { businessToday, formatDate } from '../utils/dates';
import type { BackupStatus } from '../types/ui';

export async function getBackupStatus(): Promise<BackupStatus> {
  const c = await connection();
  const lastLog = await c.auditLogs
    .find({ action: 'BACKUP_DATABASE' })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();

  if (!lastLog) {
    return {
      lastBackupAt: null,
      daysAgo: null,
      needsBackup: true,
    };
  }

  const lastDate = lastLog.createdAt;
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const formattedTime = lastDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });

  return {
    lastBackupAt: `${formatDate(lastDate)} ${formattedTime}`,
    daysAgo,
    needsBackup: daysAgo >= 14,
    rawDate: lastDate.toISOString(),
  };
}

export async function backupToTelegram(actorId: ObjectId) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    throw new DomainError(
      'SETUP_REQUIRED',
      'TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID belum dikonfigurasi di file .env.',
    );
  }

  const c = await connection();
  const [customers, credits, installments, payments, auditLogs, users] = await Promise.all([
    c.customers.find({}).toArray(),
    c.credits.find({}).toArray(),
    c.installments.find({}).toArray(),
    c.payments.find({}).toArray(),
    c.auditLogs.find({}).toArray(),
    c.users.find({}, { projection: { passwordHash: 0 } }).toArray(),
  ]);

  const summary = {
    customers: customers.length,
    credits: credits.length,
    installments: installments.length,
    payments: payments.length,
    auditLogs: auditLogs.length,
    users: users.length,
  };

  const backupPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    database: process.env.MONGODB_DB_NAME?.trim() || 'kredit',
    summary,
    collections: {
      customers,
      credit_contracts: credits,
      installments,
      payments,
      audit_logs: auditLogs,
      users,
    },
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const compressed = gzipSync(Buffer.from(jsonString, 'utf-8'));
  const sizeKb = (compressed.length / 1024).toFixed(1);

  const dateTag = businessToday();
  const timeTag = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(':', '');
  const fileName = `kredit-backup-${dateTag}-${timeTag}.json.gz`;

  const caption =
    `📦 *Backup Database Kredit*\n\n` +
    `📅 *Waktu:* ${formatDate(new Date())} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB\n` +
    `📊 *Ringkasan Data:*\n` +
    `• Pelanggan: ${summary.customers}\n` +
    `• Kontrak Kredit: ${summary.credits}\n` +
    `• Jadwal Cicilan: ${summary.installments}\n` +
    `• Pembayaran: ${summary.payments}\n` +
    `• Log Audit: ${summary.auditLogs}\n` +
    `💾 *Ukuran Berkas:* ${sizeKb} KB\n\n` +
    `🔒 _Cadangan data terkompresi gzip._`;

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('parse_mode', 'Markdown');
  form.append('document', new Blob([compressed], { type: 'application/gzip' }), fileName);

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Koneksi gagal';
    throw new DomainError('TELEGRAM_ERROR', `Koneksi ke Telegram gagal: ${msg}`);
  }

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({ description: response.statusText }))) as {
      description?: string;
    };
    const detail = errBody.description || response.statusText;
    throw new DomainError('TELEGRAM_ERROR', `Telegram Bot API menolak pengiriman: ${detail}`);
  }

  await audit(c, undefined, actorId, 'BACKUP_DATABASE', 'USER', actorId, {
    fileName,
    sizeBytes: compressed.length,
    counts: summary,
  });

  return {
    fileName,
    sizeKb,
    summary,
  };
}
