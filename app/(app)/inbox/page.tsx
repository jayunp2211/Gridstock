import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Inbox() {
  const u = await requireUser();
  const rows = await q<{ id: string; body: string; link: string | null; read_at: string | null; created_at: string }>(
    `select * from notifications where user_id = $1 order by created_at desc limit 100`, [u.id]);
  await q(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [u.id]);
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Notifications</span>
          <h1>Inbox</h1>
          <p className="lead">These will also go out by email once email delivery is connected.</p>
        </div>
      </div>
      {rows.length === 0 && <div className="empty">Nothing yet.</div>}
      {rows.map(n => {
        const inner = (
          <div className="row">
            <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
              {!n.read_at && <span className="pill on">New</span>}<span>{n.body}</span>
            </div>
            <span className="meta" style={{ margin: 0 }}>{new Date(n.created_at).toISOString().slice(0, 10)}</span>
          </div>
        );
        return n.link ? <Link key={n.id} href={n.link} className="card">{inner}</Link> : <div key={n.id} className="card">{inner}</div>;
      })}
    </>
  );
}
