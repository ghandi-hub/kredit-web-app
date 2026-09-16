import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import argon2 from 'argon2';
import { connection, indexes, transaction } from '../src/lib/server/db';
import { savePerson, deletePerson } from '../src/lib/server/people';
import { saveCredit, deleteCredit } from '../src/lib/server/credits';
import { createPayment } from '../src/lib/server/payments';
import { getUser, login, logout } from '../src/lib/server/auth';
import { loadView } from '../src/lib/server/views';
import { storage } from '../src/lib/server/storage';
import { businessToday } from '../src/lib/utils/dates';
import { installCloudinaryFake } from './cloudinary-fake';
import { processStorageCleanup, queueStorageCleanup } from '../src/lib/server/storage-cleanup';
const restoreCloudinary = installCloudinaryFake();
let replica: MongoMemoryReplSet, customerId: string;
const actor = new ObjectId(),
  now = new Date();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5b8AAAAASUVORK5CYII=',
  'base64',
);
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '7.0.24' },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.MONGODB_DB_NAME = 'kredit_test';
  process.env.SESSION_SECRET = 'test-secret-only-'.repeat(3);
  await indexes();
  const c = await connection();
  await c.users.insertOne({
    _id: actor,
    username: 'testowner',
    name: 'Test owner',
    role: 'ADMIN',
    passwordHash: await argon2.hash('test-only-password'),
    createdAt: now,
    updatedAt: now,
  });
  const form = new FormData();
  Object.entries({
    name: 'Pelanggan Uji',
    nik: '0000000000000001',
    dateOfBirth: '1990-01-01',
    phone: '080000000001',
    address: 'Alamat pengujian',
  }).forEach(([k, v]) => form.set(k, v));
  form.set('ktp', new File([png], 'ktp.png', { type: 'image/png' }));
  customerId = await savePerson('customers', form, actor);
});
afterAll(async () => {
  const c = await connection();
  await c.client.close();
  await replica?.stop();
  restoreCloudinary();
});
const creditInput = () => ({
  customerId,
  supplierName: 'Supplier Uji',
  itemName: 'Barang Uji',
  purchasePrice: 1000000,
  creditPrice: 1400000,
  downPayment: 200000,
  tenorMonths: 3,
  startDate: '2026-01-31',
  method: 'CASH',
});
const payment = (creditId: string, amount: number, requestId = new ObjectId().toHexString()) => ({
  creditId,
  amount,
  requestId,
  paymentDate: businessToday(),
  method: 'CASH',
  notes: '',
});
function customerForm(nik: string, withPhoto = true) {
  const form = new FormData();
  Object.entries({
    name: 'Pelanggan Cleanup',
    nik,
    dateOfBirth: '1990-01-01',
    phone: '080000000002',
    address: 'Alamat uji cleanup',
  }).forEach(([key, value]) => form.set(key, value));
  if (withPhoto) form.set('ktp', new File([png], 'ktp.png', { type: 'image/png' }));
  return form;
}

describe('KTP lifecycle', () => {
  it('deletes a photo only after customer deletion commits', async () => {
    const c = await connection();
    const recordId = await savePerson('customers', customerForm('0000000000000101'), actor);
    const customer = await c.customers.findOne({ _id: new ObjectId(recordId) });
    const key = customer!.ktpPhoto.storageKey;
    const originalDelete = storage.delete;
    const deletion = vi.spyOn(storage, 'delete').mockImplementation(async (key) => {
      expect(await c.customers.findOne({ _id: customer!._id })).toBeNull();
      await originalDelete(key);
    });
    try {
      await deletePerson('customers', recordId, actor);
      expect(deletion).toHaveBeenCalledWith(key);
      await expect(storage.get(key)).rejects.toThrow();
      expect(await c.db.collection('storage_cleanup').countDocuments()).toBe(0);
    } finally {
      deletion.mockRestore();
    }
  });

  it('preserves the current photo on edits without a replacement and removes replaced photos', async () => {
    const c = await connection();
    const nik = '0000000000000102';
    const recordId = await savePerson('customers', customerForm(nik), actor);
    const read = () => c.customers.findOne({ _id: new ObjectId(recordId) });
    const oldKey = (await read())!.ktpPhoto.storageKey;
    await savePerson('customers', customerForm(nik, false), actor, recordId);
    expect((await read())!.ktpPhoto.storageKey).toBe(oldKey);
    expect(await storage.get(oldKey)).toEqual(png);
    await savePerson('customers', customerForm(nik), actor, recordId);
    const newKey = (await read())!.ktpPhoto.storageKey;
    expect(newKey).not.toBe(oldKey);
    expect(await storage.get(newKey)).toEqual(png);
    await expect(storage.get(oldKey)).rejects.toThrow();
    await deletePerson('customers', recordId, actor);
  });

  it('retains the old photo on rollback and cleans up the failed replacement', async () => {
    const c = await connection();
    const recordId = await savePerson('customers', customerForm('0000000000000103'), actor);
    const oldKey = (await c.customers.findOne({ _id: new ObjectId(recordId) }))!.ktpPhoto
      .storageKey;
    const upload = vi.spyOn(storage, 'upload');
    try {
      // Duplicate NIK fails after the replacement has been uploaded.
      await expect(
        savePerson('customers', customerForm('0000000000000001'), actor, recordId),
      ).rejects.toThrow();
      const replacement = await upload.mock.results[0].value;
      await expect(storage.get(replacement.storageKey)).rejects.toThrow();
      expect(await storage.get(oldKey)).toEqual(png);
      expect(
        (await c.customers.findOne({ _id: new ObjectId(recordId) }))!.ktpPhoto.storageKey,
      ).toBe(oldKey);
    } finally {
      upload.mockRestore();
    }
    await deletePerson('customers', recordId, actor);
  });

  it('keeps durable cleanup jobs when Cloudinary fails, then retries successfully', async () => {
    const c = await connection();
    const recordId = await savePerson('customers', customerForm('0000000000000104'), actor);
    const key = (await c.customers.findOne({ _id: new ObjectId(recordId) }))!.ktpPhoto.storageKey;
    const deletion = vi
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('Provider unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await deletePerson('customers', recordId, actor);
      expect(await c.customers.findOne({ _id: new ObjectId(recordId) })).toBeNull();
      const job = await c.db
        .collection<{ _id: string; attempts: number }>('storage_cleanup')
        .findOne({ _id: key });
      expect(job?.attempts).toBe(1);
      expect(await storage.get(key)).toEqual(png);
    } finally {
      deletion.mockRestore();
      log.mockRestore();
    }
    await processStorageCleanup(key);
    await expect(storage.get(key)).rejects.toThrow();
    expect(await c.db.collection('storage_cleanup').countDocuments()).toBe(0);
  });

  it('does not delete a photo that is still referenced by a customer', async () => {
    const c = await connection();
    const recordId = await savePerson('customers', customerForm('0000000000000105'), actor);
    const key = (await c.customers.findOne({ _id: new ObjectId(recordId) }))!.ktpPhoto.storageKey;
    await queueStorageCleanup(c, key);
    await processStorageCleanup(key);
    expect(await storage.get(key)).toEqual(png);
    await deletePerson('customers', recordId, actor);
  });
});
describe('MongoDB replica set integration', () => {
  it('stores an optional supplier directly on the credit and exposes a text field', async () => {
    const c = await connection();
    const recordId = await saveCredit({ ...creditInput(), supplierName: undefined }, actor);
    const credit = await c.credits.findOne({ _id: new ObjectId(recordId) });
    expect(credit?.supplierName).toBe('');
    expect(credit).not.toHaveProperty('supplierId');
    const view = await loadView('credits/new', new URL('http://localhost/credits/new'));
    const field = view.fields.find((i) => i.name === 'supplierName');
    expect(field).toBeDefined();
    expect(field?.required).toBeUndefined();
    expect(field?.options).toBeUndefined();
    await saveCredit({ ...creditInput(), supplierName: '  Toko Bebas  ' }, actor, recordId);
    const detail = await loadView(`credits/${recordId}`, new URL('http://localhost'));
    expect(detail.details).toContainEqual({ label: 'Supplier', value: 'Toko Bebas' });
    expect(await c.db.collection('suppliers').countDocuments()).toBe(0);
    await expect(loadView('suppliers', new URL('http://localhost'))).rejects.toThrow('Halaman');
  });

  it('preserves legacy supplier names and removes the reference when edited', async () => {
    const c = await connection();
    const legacyId = new ObjectId();
    await c.db.collection('suppliers').insertOne({ _id: legacyId, name: 'Toko Lama' });
    const recordId = await saveCredit(creditInput(), actor);
    await c.credits.updateOne(
      { _id: new ObjectId(recordId) },
      { $unset: { supplierName: 1 }, $set: { supplierId: legacyId } },
    );
    const view = await loadView(`credits/${recordId}/edit`, new URL('http://localhost'));
    expect(view.values.supplierName).toBe('Toko Lama');
    await saveCredit({ ...creditInput(), supplierName: view.values.supplierName }, actor, recordId);
    await c.db.collection('suppliers').deleteOne({ _id: legacyId });
    const credit = await c.credits.findOne({ _id: new ObjectId(recordId) });
    expect(credit?.supplierName).toBe('Toko Lama');
    expect(credit).not.toHaveProperty('supplierId');
    const detail = await loadView(`credits/${recordId}`, new URL('http://localhost'));
    expect(detail.details).toContainEqual({ label: 'Supplier', value: 'Toko Lama' });
  });

  it('creates a credit, schedule, DP and audit atomically', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    const c = await connection();
    const rows = await c.installments
      .find({ creditId: new ObjectId(creditId) })
      .sort({ sequence: 1 })
      .toArray();
    expect(rows.map((i) => i.amount)).toEqual([400000, 400000, 400000]);
    expect(businessToday(rows[0].dueDate)).toBe('2026-02-28');
    const dp = await c.payments.findOne({ creditId: new ObjectId(creditId) });
    expect(dp?.amount).toBe(200000);
    expect(dp?.allocations).toEqual([]);
    expect(await c.auditLogs.countDocuments({ entityId: new ObjectId(creditId) })).toBe(1);
  });
  it('supports partial, mixed multi-month payment and exact settlement', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    await createPayment(payment(creditId, 100000), actor);
    await createPayment(payment(creditId, 500000), actor);
    const c = await connection();
    const rows = await c.installments
      .find({ creditId: new ObjectId(creditId) })
      .sort({ sequence: 1 })
      .toArray();
    expect(rows.map((i) => i.paidAmount)).toEqual([400000, 200000, 0]);
    await createPayment(payment(creditId, 600000), actor);
    expect((await c.credits.findOne({ _id: new ObjectId(creditId) }))?.status).toBe('PAID');
    expect(
      (await c.installments.find({ creditId: new ObjectId(creditId) }).toArray()).every(
        (i) => i.amount === i.paidAmount,
      ),
    ).toBe(true);
  });
  it('rejects overpayment without side effects', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    const c = await connection();
    const before = await c.payments.countDocuments();
    await expect(createPayment(payment(creditId, 1200001), actor)).rejects.toThrow('melebihi');
    expect(await c.payments.countDocuments()).toBe(before);
    expect((await c.installments.findOne({ creditId: new ObjectId(creditId) }))?.paidAmount).toBe(
      0,
    );
  });
  it('prevents concurrent overpayment', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    const outcomes = await Promise.allSettled([
      createPayment(payment(creditId, 700000), actor),
      createPayment(payment(creditId, 700000), actor),
    ]);
    expect(outcomes.filter((i) => i.status === 'fulfilled')).toHaveLength(1);
    const c = await connection();
    expect(
      (await c.payments.find({ creditId: new ObjectId(creditId) }).toArray()).reduce(
        (s, p) => s + p.amount,
        0,
      ),
    ).toBe(900000);
  });
  it('deduplicates concurrent payment retries and rejects changed payload', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    const input = payment(creditId, 400000);
    const result = await Promise.all([createPayment(input, actor), createPayment(input, actor)]);
    expect(result[0]).toBe(result[1]);
    const c = await connection();
    expect(await c.payments.countDocuments({ creditId: new ObjectId(creditId) })).toBe(2);
    await expect(createPayment({ ...input, amount: 300000 }, actor)).rejects.toThrow(
      'sudah digunakan',
    );
  });
  it('allows edits before installments, preserves DP, then locks financial history', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    await saveCredit({ ...creditInput(), creditPrice: 1300000, tenorMonths: 4 }, actor, creditId);
    const c = await connection();
    expect(await c.installments.countDocuments({ creditId: new ObjectId(creditId) })).toBe(4);
    expect(await c.payments.countDocuments({ creditId: new ObjectId(creditId) })).toBe(1);
    await expect(saveCredit({ ...creditInput(), downPayment: 0 }, actor, creditId)).rejects.toThrow(
      'DP',
    );
    await createPayment(payment(creditId, 1), actor);
    await expect(saveCredit(creditInput(), actor, creditId)).rejects.toThrow('cicilan');
  });
  it('protects customer references, cascades only confirmed credit service deletion', async () => {
    const creditId = await saveCredit(creditInput(), actor);
    const c = await connection();
    const photo = (await c.customers.findOne({ _id: new ObjectId(customerId) }))!.ktpPhoto;
    await expect(deletePerson('customers', customerId, actor)).rejects.toThrow('digunakan');
    expect(await storage.get(photo.storageKey)).toEqual(png);
    expect(await c.db.collection('storage_cleanup').countDocuments()).toBe(0);
    await deleteCredit(creditId, actor);
    expect(await c.installments.countDocuments({ creditId: new ObjectId(creditId) })).toBe(0);
    expect(await c.payments.countDocuments({ creditId: new ObjectId(creditId) })).toBe(0);
    expect(
      await c.auditLogs.countDocuments({
        entityId: new ObjectId(creditId),
        action: 'DELETE_CREDIT',
      }),
    ).toBe(1);
  });
  it('rolls back a transaction after an injected failure', async () => {
    const c = await connection(),
      key = new ObjectId();
    await expect(
      transaction(async (db, session) => {
        await db.db
          .collection('transaction_probe')
          .insertOne({ _id: key, name: 'Rollback', createdAt: now, updatedAt: now }, { session });
        throw new Error('Injected failure');
      }),
    ).rejects.toThrow('Injected');
    expect(await c.db.collection('transaction_probe').findOne({ _id: key })).toBeNull();
  });
  it('checks dashboard and detail against actual payment balances', async () => {
    const view = await loadView('dashboard', new URL('http://localhost/dashboard'));
    const c = await connection();
    const credits = await c.credits.find({}).toArray(),
      payments = await c.payments.find({}).toArray();
    const total =
      credits.reduce((s, i) => s + i.creditPrice, 0) - payments.reduce((s, i) => s + i.amount, 0);
    expect(view.metrics[0].value).toContain(new Intl.NumberFormat('id-ID').format(total));
  });
  it('uses private files and rejects spoofed upload', async () => {
    const c = await connection();
    const customer = await c.customers.findOne({ _id: new ObjectId(customerId) });
    expect(await storage.get(customer!.ktpPhoto.storageKey)).toEqual(png);
    await expect(
      storage.upload(new File(['<script>bad</script>'], 'evil.png', { type: 'image/png' })),
    ).rejects.toThrow('valid');
    await expect(storage.get('../private')).rejects.toThrow('valid');
  });
  it('uses revocable authenticated sessions and rate limiting', async () => {
    await expect(login('testowner', 'wrong', 'test-address')).rejects.toThrow('salah');
    const token = await login('testowner', 'test-only-password', 'test-address');
    expect((await getUser(token))?.username).toBe('testowner');
    await logout(token);
    expect(await getUser(token)).toBeNull();
    for (let i = 0; i < 10; i++)
      await expect(login('testowner', 'wrong', 'limited-address')).rejects.toThrow();
    await expect(login('testowner', 'wrong', 'limited-address')).rejects.toThrow('Terlalu banyak');
  });
});
