import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import argon2 from 'argon2';
import { connection, indexes } from '../src/lib/server/db';
import { installCloudinaryFake } from '../tests/cloudinary-fake';
const restoreCloudinary = installCloudinaryFake();
import { createServer } from 'vite';
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: { version: '7.0.24' },
});
process.env.MONGODB_URI = replica.getUri();
process.env.MONGODB_DB_NAME = 'kredit_e2e';
process.env.SESSION_SECRET = 'e2e-ephemeral-secret-only-'.repeat(2);
await indexes();
const c = await connection();
const now = new Date();
await c.users.insertOne({
  _id: new ObjectId(),
  username: 'e2eowner',
  passwordHash: await argon2.hash('e2e-only-password'),
  name: 'Pemilik Uji',
  role: 'ADMIN',
  createdAt: now,
  updatedAt: now,
});
const server = await createServer({ server: { host: '127.0.0.1', port: 4173, strictPort: true } });
await server.listen();
const stop = async () => {
  await server.close();
  await c.client.close();
  await replica.stop();
  restoreCloudinary();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
