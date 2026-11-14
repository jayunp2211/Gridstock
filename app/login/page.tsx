import { q } from '@/lib/db';
import { signIn, signUp } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const users = await q<{ id: string; name: string; company: string; role: string }>(
    `select id, name, company, role from users order by role, name`);
  return (
    <>
      <h1>Sign in</h1>
      <p className="lead">Prototype sign-in. Real accounts will use email magic links.</p>
      <div className="grid2">
        <form action={signUp} className="card stack">
          <h2 style={{ marginTop: 0 }}>Create an account</h2>
          <label>I want to
            <select name="role" defaultValue={role === 'buyer' ? 'buyer' : 'seller'}>
              <option value="seller">List gear I have</option>
              <option value="buyer">Find gear I need</option>
            </select>
          </label>
          <label>Name<input name="name" required /></label>
          <label>Work email<input name="email" type="email" required /></label>
          <label>Company<input name="company" required /></label>
          <button>Continue</button>
        </form>
        {users.length > 0 && (
          <form action={signIn} className="card stack">
            <h2 style={{ marginTop: 0 }}>Demo accounts</h2>
            <label>Sign in as
              <select name="user_id">
                {users.map(u => <option key={u.id} value={u.id}>{u.role}: {u.name}, {u.company}</option>)}
              </select>
            </label>
            <button className="secondary">Sign in</button>
          </form>
        )}
      </div>
    </>
  );
}
