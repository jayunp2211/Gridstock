import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { STAGE_LABEL, money } from '@/lib/labels';
import { Spec, cat, day } from '@/components/ui';

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
      <div className="head">
        <div>
          <h1>Deals</h1>
          <p>Every deal moves through NDA, documents, offer, independent inspection and escrow.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="blank">No deals yet. A deal room opens when a buyer requests an intro on a match.</p>
      ) : (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Equipment</th><th className="wide-only">Rating</th><th className="wide-only">Fit</th><th>Stage</th><th>Offer</th><th className="wide-only">Updated</th></tr>
            </thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id}>
                  <td className="lead-cell">
                    <Link href={`/deals/${d.id}`}>{d.oem}</Link>
                    <div className="under">{cat(d.category)}</div>
                  </td>
                  <td className="wide-only"><Spec x={d} /></td>
                  <td className="wide-only num">{d.score}</td>
                  <td>{STAGE_LABEL[d.stage]}</td>
                  <td className="num">{d.offer_price == null ? <span className="soft">None yet</span> : money(d.offer_price)}</td>
                  <td className="wide-only num">{day(d.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
