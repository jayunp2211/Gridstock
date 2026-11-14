import { q } from '@/lib/db';
import { signIn, signUp } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const users = await q<{ id: string; name: string; company: string; role: string }>(
    `select id, name, company, role from users order by role, name`);
  return (
    <div className="auth">
      <div className="page-head">
        <div>
          <span className="eyebrow">Welcome</span>
          <h1>Sign in to Gridstock</h1>
          <p className="lead">Prototype sign-in. Real accounts will use email magic links.</p>
        </div>
      </div>
      <div className="grid2">
        <form action={signUp} className="card stack">
          <h2>Create an account</h2>
          <label>I want to
            <select name="role" defaultValue={role === 'buyer' ? 'buyer' : 'seller'}>
              <option value="seller">List gear I have</option>
              <option value="buyer">Find gear I need</option>
            </select>
          </label>
          <label>Name<input name="name" required autoComplete="name" /></label>
          <label>Work email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Company<input name="company" required autoComplete="organization" /></label>
          <div><button className="primary">Continue</button></div>
        </form>
        {users.length > 0 && (
          <form action={signIn} className="card stack" style={{ alignContent: 'start' }}>
            <h2>Demo accounts</h2>
            <p className="muted small" style={{ margin: 0 }}>Explore with fictional companies and gear. Try a buyer to see ranked matches, or Ops to see the pipeline.</p>
            <label>Sign in as
              <select name="user_id">
                {users.map(u => <option key={u.id} value={u.id}>{u.role}: {u.name}, {u.company}</option>)}
              </select>
            </label>
            <div><button className="secondary">Sign in</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
