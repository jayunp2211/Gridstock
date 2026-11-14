// Prototype session: a signed-in user id in a cookie.
// Replace with Supabase Auth (magic link) before real users touch this.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one } from './db';

export type User = { id: string; email: string; name: string; company: string; role: 'seller' | 'buyer' | 'admin'; verified: boolean };

export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get('uid')?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return one<User>('select * from users where id = $1', [id]);
}

export async function requireUser(role?: User['role']): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (role && u.role !== role && u.role !== 'admin') redirect('/');
  return u;
}
