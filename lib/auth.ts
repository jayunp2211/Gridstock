// Prototype session: a signed-in user id in a cookie.
// Only the sample accounts (addresses ending in .test) can hold a session, because they are the
// only ones that can be entered without proof of identity. Real accounts wait for email sign-in.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one } from './db';

export type User = { id: string; email: string; name: string; company: string; role: 'seller' | 'buyer' | 'admin'; verified: boolean };

/** SQL test for a sample account, for a users row aliased as `u`. */
export const IS_SAMPLE = `u.email like '%.test'`;

export const SESSION = {
  httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12, secure: process.env.NODE_ENV === 'production',
} as const;

export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get('uid')?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return one<User>(`select u.* from users u where u.id = $1 and ${IS_SAMPLE}`, [id]);
}

export async function requireUser(role?: User['role']): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (role && u.role !== role && u.role !== 'admin') redirect('/');
  return u;
}
