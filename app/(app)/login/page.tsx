import { q } from '@/lib/db';
import { fieldError } from '@/lib/labels';
import { requestAccess, signIn } from '@/app/actions';
import { Arrow } from '@/components/ui';

export const dynamic = 'force-dynamic';

const GROUPS: [string, string][] = [['buyer', 'Buyers'], ['seller', 'Sellers'], ['admin', 'Operations']];

export default async function Login({ searchParams }: { searchParams: Promise<{ role?: string; requested?: string; error?: string }> }) {
  const { role, requested, error } = await searchParams;
  // Only sample accounts are offered here. A real account is never listed and cannot be entered from this page.
  const users = await q<{ id: string; name: string; company: string; role: string }>(
    `select id, name, company, role from users where email like '%.test' order by role, name`);
  return (
    <>
      <div className="head">
        <div>
          <h1>Join Gridstock</h1>
          <p>We are opening to a first group of sellers and builders, and we check every company by hand. Look around with a sample account in the meantime.</p>
        </div>
      </div>
      {requested && <div className="notice" role="status">Thanks. Your request is in, and we will reply by email.</div>}
      {error && <div className="notice" role="alert">{fieldError(error)}</div>}
      <div className="doors">
        <form action={requestAccess} className="stack">
          <h2>Request access</h2>
          <p className="soft">For companies holding gear or needing it. Nothing is listed or shared until we have spoken to you.</p>
          <label>I want to
            <select name="role" defaultValue={role === 'buyer' ? 'buyer' : 'seller'}>
              <option value="seller">List gear I have</option>
              <option value="buyer">Find gear I need</option>
            </select>
          </label>
          <label>Name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
          <label>Work email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
          <label>Company<input name="company" required minLength={2} maxLength={120} autoComplete="organization" /></label>
          <label className="trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <div><button className="go">Request access<Arrow /></button></div>
        </form>
        {users.length > 0 && (
          <form action={signIn} className="stack" id="demo">
            <h2>Try the demo</h2>
            <p className="soft">Fictional companies and gear. Try a buyer to see ranked matches, a seller to see who needs their gear, or Operations to see the whole pipeline. Other visitors share this demo, and it is reset from time to time.</p>
            <label>Sign in as
              <select name="user_id" defaultValue={users.find(x => x.role === (role === 'seller' ? 'seller' : 'buyer'))?.id}>
                {GROUPS.map(([r, title]) => (
                  <optgroup key={r} label={title}>
                    {users.filter(x => x.role === r).map(x => <option key={x.id} value={x.id}>{x.name}, {x.company}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div><button>Sign in to the demo</button></div>
          </form>
        )}
      </div>
    </>
  );
}
