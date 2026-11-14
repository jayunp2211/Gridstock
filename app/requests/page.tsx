import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, label, date, specLine } from '@/lib/labels';

export const dynamic = 'force-dynamic';

type Row = { id: string; category: string; voltage_v: number; amps_min: number; kaic_min: number | null; enclosure: string | null;
  quantity: number; site_state: string; need_by: string; status: string; matches: number; best: number | null };

export default async function Requests() {
  const u = await requireUser('buyer');
  const rows = await q<Row>(
    `select r.*, (select count(*)::int from matches m where m.request_id = r.id) as matches,
            (select max(score) from matches m where m.request_id = r.id) as best
     from requests r where r.buyer_id = $1 order by r.created_at desc`, [u.id]);
  return (
    <>
      <div className="row"><div><h1>My requests</h1><p className="lead">Each request is matched against every active listing, and again whenever new gear is listed.</p></div>
        <Link href="/requests/new"><button>Post a need</button></Link></div>
      {rows.length === 0 && <p className="muted">No requests yet.</p>}
      {rows.map(r => (
        <Link key={r.id} href={`/requests/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="card row">
            <div>
              <strong>{label(CATEGORIES, r.category)} · qty {r.quantity}</strong> <span className="pill">{r.status.replace('_', ' ')}</span>
              <div className="muted small">{specLine(r)} · site {r.site_state} · need by {date(r.need_by)}</div>
            </div>
            <div className="small" style={{ textAlign: 'right' }}>
              <div><strong>{r.matches}</strong> matches</div>
              <div className="muted">best fit {r.best ?? '—'}</div>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}
