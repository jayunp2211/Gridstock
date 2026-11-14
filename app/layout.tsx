import './globals.css';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { signOut } from './actions';
import { one } from '@/lib/db';

export const metadata = { title: 'Gridstock', description: 'Stranded switchgear, breakers and cooling, matched to builds that need them now.' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const unread = u ? await one<{ n: number }>('select count(*)::int as n from notifications where user_id = $1 and read_at is null', [u.id]) : null;
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">Gridstock</Link>
          <nav>
            {u?.role === 'seller' && <><Link href="/listings">My listings</Link><Link href="/listings/new">List gear</Link></>}
            {u?.role === 'buyer' && <><Link href="/requests">My requests</Link><Link href="/requests/new">Post a need</Link></>}
            {u && <Link href="/deals">Deals</Link>}
            {u?.role === 'admin' && <Link href="/admin">Ops</Link>}
            {u && <Link href="/inbox">Inbox{unread?.n ? <span className="badge">{unread.n}</span> : null}</Link>}
          </nav>
          <div className="who">
            {u ? (
              <form action={signOut}><span>{u.name} · {u.company}</span> <button className="link">Sign out</button></form>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
