import '@fontsource-variable/archivo/wdth.css';
import './globals.css';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { signOut } from './actions';
import { one } from '@/lib/db';

export const metadata = {
  title: 'Gridstock. Surplus switchgear, breakers and cooling for data center builds',
  description: 'A private market for new and never-energized electrical and cooling equipment from paused data center projects, matched to your spec and energization date.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const unread = u ? await one<{ n: number }>('select count(*)::int as n from notifications where user_id = $1 and read_at is null', [u.id]) : null;
  return (
    <html lang="en">
      <body>
        <header className="frame nav">
          <Link href="/" className="wordmark">Gridstock</Link>
          <nav aria-label="Main">
            {!u && <><Link href="/#available">Available gear</Link><Link href="/#wanted">Wanted</Link><Link href="/#how">How a deal runs</Link></>}
            {u?.role === 'seller' && <><Link href="/listings">My listings</Link><Link href="/listings/new">List gear</Link></>}
            {u?.role === 'buyer' && <><Link href="/requests">My requests</Link><Link href="/requests/new">Post a need</Link></>}
            {u && <Link href="/deals">Deals</Link>}
            {u?.role === 'admin' && <Link href="/admin">Operations</Link>}
            {u && <Link href="/inbox">Inbox{unread?.n ? <span className="count">{unread.n}</span> : null}</Link>}
          </nav>
          <div className="side">
            {u ? (
              <form action={signOut}><span className="who soft">{u.name}, {u.company}</span><button className="text">Sign out</button></form>
            ) : (
              <Link href="/login" className="u">Sign in</Link>
            )}
          </div>
        </header>
        {children}
        <footer className="frame colophon">
          <div className="meta small">
            <span>A private market for data center power and cooling equipment.</span>
            <span>Sellers and prices stay hidden until both sides sign an NDA.</span>
            <span>© 2026 Gridstock</span>
          </div>
          <div className="fit-name"><span className="name" aria-hidden="true">Gridstock</span></div>
        </footer>
      </body>
    </html>
  );
}
