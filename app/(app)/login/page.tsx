import { q } from '@/lib/db';
import { signIn, signUp } from '@/app/actions';
import { Arrow } from '@/components/ui';

export const dynamic = 'force-dynamic';

const GROUPS: [string, string][] = [['buyer', 'Buyers'], ['seller', 'Sellers'], ['admin', 'Operations']];

export default async function Login({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const users = await q<{ id: string; name: string; company: string; role: string }>(
    `select id, name, company, role from users order by role, name`);
  return (
    <>
      <div className="head">
        <div>
          <h1>Sign in</h1>
          <p>Prototype sign-in. Real accounts will use email magic links.</p>
        </div>
      </div>
      <div className="doors">
        <form action={signUp} className="stack">
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
          <div><button className="go">Continue<Arrow /></button></div>
        </form>
        {users.length > 0 && (
          <form action={signIn} className="stack">
            <h2>Use a demo account</h2>
            <p className="soft">Fictional companies and gear. Try a buyer to see ranked matches, or Operations to see the whole pipeline.</p>
            <label>Sign in as
              <select name="user_id" defaultValue={users.find(x => x.role === (role === 'seller' ? 'seller' : 'buyer'))?.id}>
                {GROUPS.map(([r, title]) => (
                  <optgroup key={r} label={title}>
                    {users.filter(x => x.role === r).map(x => <option key={x.id} value={x.id}>{x.name}, {x.company}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div><button>Sign in</button></div>
          </form>
        )}
      </div>
    </>
  );
}
