import { error } from '@sveltejs/kit';
import { connection, id } from '$lib/server/db';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  const c = await connection();
  const customer = await c.customers.findOne({ _id: id(params.id) });
  if (!customer?.ktpPhoto) error(404, 'Foto KTP tidak ditemukan.');
  const bytes = await storage.get(customer.ktpPhoto.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': customer.ktpPhoto.mimeType,
      'Content-Disposition': 'inline; filename="ktp"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
