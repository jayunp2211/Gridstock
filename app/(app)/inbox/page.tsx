import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { day } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Inbox() {
  const u = await requireUser();
  const rows = await q<{ id: string; body: string; link: string | null; read_at: string | null; created_at: string }>(
    `select * from notifications where user_id = $1 order by created_at desc limit 100`, [u.id]);
  await q(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [u.id]);
  return (
    <>
      <div className="head">
        <div>
          <h1>Inbox</h1>
          <p>These will also go out by email once email delivery is connected.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="blank">Nothing yet. Matches, intro requests and deal updates will show up here.</p>
      ) : (
        <ul className="log">
          {rows.map(n => (
            <li key={n.id} className={n.read_at ? undefined : 'unread'}>
              <div className="by">{n.read_at ? '' : 'New'}<time dateTime={new Date(n.created_at).toISOString()}>{day(n.created_at)}</time></div>
              <p>{n.link ? <Link href={n.link}>{n.body}</Link> : n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
