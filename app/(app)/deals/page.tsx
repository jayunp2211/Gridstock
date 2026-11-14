import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { STAGE_LABEL, money } from '@/lib/labels';
import { Specs, cat } from '@/components/ui';

export const dynamic = 'force-dynamic';

type D = { id: string; stage: string; offer_price: number | null; updated_at: string; category: string; oem: string;
  voltage_v: number; amps: number; kaic: number | null; enclosure: string | null; score: number };

export default async function Deals() {
  const u = await requireUser();
  const rows = await q<D>(
    `select d.id, d.stage, d.offer_price, d.updated_at, l.category, l.oem, l.voltage_v, l.amps, l.kaic, l.enclosure, m.score
     from deals d join matches m on m.id = d.match_id join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
     where $1 in (l.seller_id, r.buyer_id) or $2 = 'admin' order by d.updated_at desc`, [u.id, u.role]);
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Pipeline</span>
          <h1>Deals</h1>
          <p className="lead">Every deal moves through NDA, documents, offer, independent inspection and escrow.</p>
        </div>
      </div>
      {rows.length === 0 && <div className="empty">No deals yet. A deal room opens when a buyer requests an intro on a match.</div>}
      {rows.map(d => (
        <Link key={d.id} href={`/deals/${d.id}`} className="card">
          <div className="row top-align">
            <div className="grow">
              <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
                <span className="title">{d.oem} · {cat(d.category)}</span><span className="pill on">{STAGE_LABEL[d.stage]}</span>
              </div>
              <Specs x={d} extra={[['Fit', String(d.score)]]} />
            </div>
            <div className="right">
              <div className="price">{money(d.offer_price)}</div>
              <div className="meta">current offer</div>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}
