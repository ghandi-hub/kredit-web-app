import type { ClientSession } from 'mongodb';
import { connection } from './db';
import { storage } from './storage';

type CleanupJob = { _id: string; createdAt: Date; nextAttemptAt: Date; attempts: number };
type Connection = Awaited<ReturnType<typeof connection>>;
const jobs = (c: Connection) => c.db.collection<CleanupJob>('storage_cleanup');

export async function queueStorageCleanup(c: Connection, key: string, session?: ClientSession) {
  const now = new Date();
  await jobs(c).updateOne(
    { _id: key },
    { $setOnInsert: { createdAt: now, nextAttemptAt: now, attempts: 0 } },
    { upsert: true, session },
  );
}

// Deletions are idempotent, so multiple app instances may safely retry a job.
// Only retired keys are queued; uploads always receive a fresh random key.
export async function processStorageCleanup(key?: string, limit = 5) {
  const c = await connection();
  const pending = await jobs(c)
    .find(key ? { _id: key } : { nextAttemptAt: { $lte: new Date() } })
    .sort({ nextAttemptAt: 1 })
    .limit(limit)
    .toArray();
  for (const job of pending) {
    try {
      // Also protects uploads when a transaction's commit result was uncertain.
      const referenced = await c.customers.findOne(
        { 'ktpPhoto.storageKey': job._id },
        { projection: { _id: 1 } },
      );
      if (!referenced) await storage.delete(job._id);
      await jobs(c).deleteOne({ _id: job._id });
    } catch {
      await jobs(c).updateOne(
        { _id: job._id },
        {
          $inc: { attempts: 1 },
          $set: { nextAttemptAt: new Date(Date.now() + 60000) },
        },
      );
      console.error('Storage cleanup pending; deletion will be retried.');
    }
  }
}

export async function tryStorageCleanup(key?: string) {
  try {
    await processStorageCleanup(key, 1);
  } catch {
    // A cleanup outage must not report an already committed customer change as failed.
    console.error('Storage cleanup unavailable; queued jobs will be retried.');
  }
}

let nextRun = 0;
export async function retryStorageCleanup() {
  if (Date.now() < nextRun) return;
  nextRun = Date.now() + 60000;
  await tryStorageCleanup();
}
