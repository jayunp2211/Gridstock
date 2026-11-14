import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, STAGE_LABEL, label, money, specLine } from '@/lib/labels';

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
      <h1>Deals</h1>
      <p className="lead">Every deal moves through NDA, documents, offer, third-party inspection and escrow.</p>
      {rows.length === 0 && <p className="muted">No deals yet.</p>}
      {rows.map(d => (
        <Link key={d.id} href={`/deals/${d.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="card row">
            <div><strong>{d.oem} · {label(CATEGORIES, d.category)}</strong> <span className="pill on">{STAGE_LABEL[d.stage]}</span>
              <div className="muted small">{specLine(d)} · fit {d.score}</div></div>
            <div className="small">{money(d.offer_price)}</div>
          </div>
        </Link>
      ))}
    </>
  );
}
