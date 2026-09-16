import { ObjectId } from 'mongodb';
import argon2 from 'argon2';
import { connection, indexes } from '../src/lib/server/db';
const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 6)
  throw new Error('ADMIN_PASSWORD wajib diisi minimal 6 karakter.');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  throw new Error('SESSION_SECRET wajib diisi minimal 32 karakter acak.');
const c = await connection();
try {
  await indexes();
  if (await c.users.countDocuments())
    console.log('Admin sudah tersedia. Akun dan password tidak diubah.');
  else {
    const now = new Date();
    await c.users.insertOne({
      _id: new ObjectId(),
      username,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      name: 'Pemilik',
      role: 'ADMIN',
      createdAt: now,
      updatedAt: now,
    });
    console.log('Akun pemilik dan indeks berhasil disiapkan.');
  }
} finally {
  await c.client.close();
}
