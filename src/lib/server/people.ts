import { ObjectId } from 'mongodb';
import { customerSchema } from '../schemas/forms';
import { businessDate } from '../utils/dates';
import { audit, connection, id, transaction } from './db';
import { DomainError } from './errors';
import { storage } from './storage';
import { queueStorageCleanup, tryStorageCleanup } from './storage-cleanup';
export async function savePerson(
  kind: 'customers',
  form: FormData,
  actorId: ObjectId,
  recordId?: string,
) {
  const raw = Object.fromEntries(form);
  const parsed = customerSchema.parse(raw);
  const entityId = recordId ? id(recordId) : new ObjectId();
  const file = form.get('ktp');
  const photo = file instanceof File && file.size ? await storage.upload(file) : undefined;
  let retiredKey: string | undefined;
  try {
    retiredKey = await transaction(async (c, session) => {
      const existing = recordId ? await c.customers.findOne({ _id: entityId }, { session }) : null;
      if (recordId && !existing) throw new DomainError('NOT_FOUND', 'Data tidak ditemukan.');
      if (!photo && !existing?.ktpPhoto)
        throw new DomainError('FILE_REQUIRED', 'Foto KTP wajib diunggah.');
      const now = new Date();
      const value = {
        ...parsed,
        ...('dateOfBirth' in parsed ? { dateOfBirth: businessDate(parsed.dateOfBirth) } : {}),
        ...(photo ? { ktpPhoto: photo } : {}),
        updatedAt: now,
      };
      if (recordId)
        await c.db.collection(kind).updateOne({ _id: entityId }, { $set: value }, { session });
      else
        await c.db
          .collection(kind)
          .insertOne({ _id: entityId, ...value, createdAt: now }, { session });
      await audit(
        c,
        session,
        actorId,
        `${recordId ? 'UPDATE' : 'CREATE'}_CUSTOMER`,
        'CUSTOMER',
        entityId,
      );
      const oldKey = photo ? existing?.ktpPhoto.storageKey : undefined;
      if (oldKey) await queueStorageCleanup(c, oldKey, session);
      return oldKey;
    });
  } catch (e) {
    if (photo) {
      try {
        await queueStorageCleanup(await connection(), photo.storageKey);
        await tryStorageCleanup(photo.storageKey);
      } catch {
        console.error('Failed upload cleanup could not be queued.');
      }
    }
    throw e;
  }
  if (retiredKey) await tryStorageCleanup(retiredKey);
  return entityId.toHexString();
}
export async function deletePerson(kind: 'customers', recordId: string, actorId: ObjectId) {
  const retiredKey = await transaction(async (c, session) => {
    const entityId = id(recordId);
    // Writing the parent serializes deletion against concurrent credit creation.
    const parent = await c.customers.findOneAndDelete({ _id: entityId }, { session });
    if (!parent) throw new DomainError('NOT_FOUND', 'Data tidak ditemukan.');
    if (
      (await c.credits.findOne({ customerId: entityId }, { session })) ||
      (await c.payments.findOne({ customerId: entityId }, { session }))
    )
      throw new DomainError(
        'HAS_REFERENCES',
        'Data sudah digunakan oleh transaksi kredit dan tidak dapat dihapus.',
      );
    await audit(c, session, actorId, `DELETE_CUSTOMER`, 'CUSTOMER', entityId);
    const key = parent.ktpPhoto?.storageKey;
    if (key) await queueStorageCleanup(c, key, session);
    return key;
  });
  if (retiredKey) await tryStorageCleanup(retiredKey);
}
