import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { date } from '@/lib/labels';
import { Specs, Status, cat } from '@/components/ui';

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
      <div className="page-head">
        <div>
          <span className="eyebrow">Buyer</span>
          <h1>My requests</h1>
          <p className="lead">Each request is matched against every active listing, and again whenever new gear is listed.</p>
        </div>
        <Link href="/requests/new" className="btn primary">Post a need</Link>
      </div>
      {rows.length === 0 && <div className="empty">No requests yet. Post the spec you need to see what is available now.</div>}
      {rows.map(r => (
        <Link key={r.id} href={`/requests/${r.id}`} className="card">
          <div className="row top-align">
            <div className="grow">
              <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                <span className="title">{cat(r.category)}</span><Status value={r.status} />
              </div>
              <div className="meta">Site in {r.site_state} · need by {date(r.need_by)}</div>
              <Specs x={r} />
            </div>
            <div className="right">
              <div className="price">{r.matches} {r.matches === 1 ? 'match' : 'matches'}</div>
              <div className="meta">{r.best != null ? `best fit ${r.best}` : 'watching for new gear'}</div>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}
