import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import { login } from '$lib/server/auth';
import { safeError } from '$lib/server/errors';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/dashboard');
  return {
    configured:
      !!process.env.MONGODB_URI &&
      !!process.env.SESSION_SECRET &&
      process.env.SESSION_SECRET.length >= 32,
  };
};
export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    const form = await request.formData(),
      username = String(form.get('username') || '').slice(0, 100),
      password = String(form.get('password') || '');
    try {
      if (!username || password.length < 1 || password.length > 1024)
        return fail(400, { message: 'Isi nama pengguna dan kata sandi.', username });
      const token = await login(username, password, getClientAddress());
      cookies.set('session', token, {
        path: '/',
        httpOnly: true,
        secure: !dev,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
      });
    } catch (e) {
      return fail(400, { message: safeError(e).message, username });
    }
    redirect(303, '/dashboard');
  },
};
