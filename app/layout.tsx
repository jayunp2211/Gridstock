import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { signOut } from './actions';
import { one } from '@/lib/db';
import { Logo } from '@/components/ui';

export const metadata = {
  title: 'Gridstock · Stranded power and cooling gear, matched to builds that need it',
  description: 'A private marketplace matching new, never-energized switchgear, breakers and cooling equipment from cancelled data center projects to builders on a deadline.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const unread = u ? await one<{ n: number }>('select count(*)::int as n from notifications where user_id = $1 and read_at is null', [u.id]) : null;
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand"><Logo />Gridstock</Link>
            <nav>
              {u?.role === 'seller' && <><Link href="/listings">My listings</Link><Link href="/listings/new">List gear</Link></>}
              {u?.role === 'buyer' && <><Link href="/requests">My requests</Link><Link href="/requests/new">Post a need</Link></>}
              {u && <Link href="/deals">Deals</Link>}
              {u?.role === 'admin' && <Link href="/admin">Ops</Link>}
              {u && <Link href="/inbox">Inbox{unread?.n ? <span className="badge">{unread.n}</span> : null}</Link>}
            </nav>
            <div className="who">
              {u ? (
                <form action={signOut}><span className="name">{u.name}</span><button className="link">Sign out</button></form>
              ) : (
                <>
                  <Link href="/login" className="btn on-dark">Sign in</Link>
                  <Link href="/login?role=seller" className="btn primary">List gear</Link>
                </>
              )}
            </div>
          </div>
        </header>
        {children}
        <footer className="foot">
          <div className="wrap">
            <span>© 2026 Gridstock. Private marketplace for data center power and cooling equipment.</span>
            <span>Listings are confidential until both parties sign an NDA.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
