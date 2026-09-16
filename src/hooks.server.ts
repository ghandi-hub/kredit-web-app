import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';
import { retryStorageCleanup } from '$lib/server/storage-cleanup';
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await getUser(event.cookies.get('session'));
  if (!event.locals.user && event.url.pathname !== '/login') redirect(303, '/login');
  const response = await resolve(event);
  if (event.locals.user) await retryStorageCleanup();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
};
export const handleError: HandleServerError = ({ error }) => {
  console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return { message: 'Halaman belum dapat dimuat. Periksa koneksi aplikasi dan coba lagi.' };
};
