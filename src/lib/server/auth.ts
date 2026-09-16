import { createHash, createHmac, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { ObjectId } from 'mongodb';
import { connection, transaction, audit } from './db';
import { DomainError } from './errors';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new DomainError('SETUP_REQUIRED', 'SESSION_SECRET harus diisi minimal 32 karakter.');
  return s;
};
export async function login(username: string, password: string, address: string) {
  const c = await connection();
  const key = createHmac('sha256', secret()).update(address).digest('hex');
  const attempts = c.db.collection<{ _id: string; count: number; expiresAt: Date }>(
    'login_attempts',
  );
  const now = new Date();
  await attempts.deleteOne({ _id: key, expiresAt: { $lte: now } });
  const attempt = await attempts.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 15 * 60 * 1000) } },
    { upsert: true, returnDocument: 'after' },
  );
  if (attempt!.count > 10)
    throw new DomainError('RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  const user = await c.users.findOne({ username: username.trim().toLowerCase() });
  const valid = user
    ? await argon2.verify(user.passwordHash, password)
    : (await argon2.hash(password), false);
  if (!user || !valid)
    throw new DomainError('UNAUTHORIZED', 'Nama pengguna atau kata sandi salah.');
  const token = randomBytes(32).toString('hex');
  await transaction(async (db, session) => {
    await db.db.collection('sessions').insertOne(
      {
        tokenHash: hash(token),
        userId: user._id,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
      { session },
    );
    await audit(db, session, user._id, 'LOGIN', 'USER', user._id);
  });
  await attempts.deleteOne({ _id: key });
  return token;
}
export async function getUser(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const c = await connection();
  const session = await c.db
    .collection<{ tokenHash: string; userId: ObjectId; expiresAt: Date }>('sessions')
    .findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await c.users.findOne({ _id: session.userId }, { projection: { passwordHash: 0 } });
  return user ? { id: user._id.toHexString(), name: user.name, username: user.username } : null;
}
export async function logout(token: string | undefined) {
  if (token) {
    const c = await connection();
    await c.db.collection('sessions').deleteOne({ tokenHash: hash(token) });
  }
}
