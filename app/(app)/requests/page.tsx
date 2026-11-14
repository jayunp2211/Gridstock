import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Spec, State, Arrow, cat, day } from '@/components/ui';

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
      <div className="head">
        <div>
          <h1>My requests</h1>
          <p>Each request is matched against every active listing, and again whenever new gear is listed.</p>
        </div>
        <Link href="/requests/new" className="btn go">Post a need<Arrow /></Link>
      </div>
      {rows.length === 0 ? (
        <p className="blank">No requests yet. Post the spec you need to see what is available now.</p>
      ) : (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Need</th><th className="wide-only">Minimum rating</th><th className="wide-only">Site</th><th>Need by</th><th>Matches</th><th className="wide-only">Best fit</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="lead-cell">
                    <Link href={`/requests/${r.id}`}>{cat(r.category)}</Link>
                    <div className="narrow-only under"><Spec x={r} /></div>
                  </td>
                  <td className="wide-only"><Spec x={r} plain /></td>
                  <td className="wide-only">{r.site_state}</td>
                  <td className="num">{day(r.need_by)}</td>
                  <td className="num">{r.matches || <span className="soft">Watching</span>}</td>
                  <td className="wide-only num">{r.best ?? <span className="soft">None yet</span>}</td>
                  <td><State value={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
