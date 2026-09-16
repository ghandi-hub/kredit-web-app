import { MongoClient, ObjectId, type ClientSession } from 'mongodb';
import type {
  AuditDocument,
  CreditDocument,
  CustomerDocument,
  InstallmentDocument,
  PaymentDocument,
  UserDocument,
} from '../types/entities';
import { DomainError } from './errors';
let clientPromise: Promise<MongoClient> | undefined;
export async function connection() {
  // Atlas URI (including appName) is loaded from .env by the app/seed command.
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new DomainError('SETUP_REQUIRED', 'Koneksi MongoDB belum dikonfigurasi.');
  if (/<db_username>|<db_password>|%3cdb_(?:username|password)%3e/i.test(uri))
    throw new DomainError(
      'SETUP_REQUIRED',
      'Ganti <db_username> dan <db_password> pada MONGODB_URI di .env dengan kredensial MongoDB Atlas Anda.',
    );
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri))
    throw new DomainError(
      'INVALID_DATABASE_CONFIG',
      'MONGODB_URI harus diawali mongodb+srv:// untuk Atlas atau mongodb:// untuk koneksi langsung.',
    );
  if (!clientPromise)
    clientPromise = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
      .connect()
      .catch((e) => {
        clientPromise = undefined;
        throw e;
      });
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME?.trim() || 'kredit');
  return {
    client,
    db,
    users: db.collection<UserDocument>('users'),
    customers: db.collection<CustomerDocument>('customers'),
    credits: db.collection<CreditDocument>('credit_contracts'),
    installments: db.collection<InstallmentDocument>('installments'),
    payments: db.collection<PaymentDocument>('payments'),
    auditLogs: db.collection<AuditDocument>('audit_logs'),
  };
}
export async function transaction<T>(
  work: (c: Awaited<ReturnType<typeof connection>>, session: ClientSession) => Promise<T>,
) {
  const c = await connection();
  const session = c.client.startSession();
  try {
    return await session.withTransaction(() => work(c, session), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await session.endSession();
  }
}
export async function indexes() {
  const c = await connection();
  await Promise.all([
    c.users.createIndex({ username: 1 }, { unique: true }),
    c.customers.createIndex({ nik: 1 }, { unique: true }),
    c.customers.createIndex({ name: 1 }),
    c.customers.createIndex({ phone: 1 }),
    c.db.collection('storage_cleanup').createIndex({ nextAttemptAt: 1 }),
    c.credits.createIndex({ contractNumber: 1 }, { unique: true }),
    c.credits.createIndex({ customerId: 1 }),
    c.credits.createIndex({ status: 1 }),
    c.credits.createIndex({ startDate: -1 }),
    c.installments.createIndex({ creditId: 1, sequence: 1 }, { unique: true }),
    c.installments.createIndex({ dueDate: 1 }),
    c.payments.createIndex({ paymentNumber: 1 }, { unique: true }),
    c.payments.createIndex({ creditId: 1, createdAt: 1 }),
    c.payments.createIndex({ customerId: 1 }),
    c.payments.createIndex({ paymentDate: -1 }),
    c.auditLogs.createIndex({ entityType: 1, entityId: 1 }),
    c.auditLogs.createIndex({ createdAt: -1 }),
    c.db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    c.db.collection('login_attempts').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
export async function nextNumber(
  c: Awaited<ReturnType<typeof connection>>,
  session: ClientSession,
  prefix: 'CR' | 'PAY',
  year: string,
) {
  const counter = await c.db
    .collection<{ _id: string; sequence: number }>('counters')
    .findOneAndUpdate(
      { _id: `${prefix}:${year}` },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after', session },
    );
  return `${prefix}-${year}-${String(counter!.sequence).padStart(6, '0')}`;
}
export function id(value: string) {
  if (!/^[a-f0-9]{24}$/i.test(value)) throw new DomainError('NOT_FOUND', 'Data tidak ditemukan.');
  return new ObjectId(value);
}
export async function audit(
  c: Awaited<ReturnType<typeof connection>>,
  session: ClientSession,
  actorId: ObjectId,
  action: string,
  entityType: AuditDocument['entityType'],
  entityId: ObjectId,
  metadata?: Record<string, unknown>,
) {
  await c.auditLogs.insertOne(
    { _id: new ObjectId(), actorId, action, entityType, entityId, metadata, createdAt: new Date() },
    { session },
  );
}
