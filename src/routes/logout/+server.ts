import { redirect } from '@sveltejs/kit';
import { logout } from '$lib/server/auth';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ cookies, request, url }) => {
  if (request.headers.get('origin') !== url.origin)
    return new Response('Forbidden', { status: 403 });
  await logout(cookies.get('session'));
  cookies.delete('session', { path: '/' });
  redirect(303, '/login');
};
