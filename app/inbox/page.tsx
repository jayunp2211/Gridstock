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
      <h1>Inbox</h1>
      <p className="lead">These will also go out by email once email delivery is connected.</p>
      {rows.length === 0 && <p className="muted">Nothing yet.</p>}
      {rows.map(n => (
        <div key={n.id} className="card row">
          <div>{!n.read_at && <span className="pill on">new</span>} {n.link ? <Link href={n.link}>{n.body}</Link> : n.body}</div>
          <div className="muted small">{new Date(n.created_at).toISOString().slice(0, 10)}</div>
        </div>
      ))}
    </>
  );
}
