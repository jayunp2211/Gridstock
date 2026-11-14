import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser, type User } from '@/lib/auth';
import { STAGE_LABEL, money } from '@/lib/labels';
import { Spec, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

type D = { id: string; stage: string; offer_price: number | null; offer_by: string | null; buyer_nda_at: string | null;
  seller_nda_at: string | null; updated_at: string; category: string; oem: string; model: string | null; voltage_v: number;
  secondary_v: number | null; amps: number | null; capacity: number | null; kaic: number | null; enclosure: string | null; buyer_id: string; seller_id: string };

/** Whose move it is, in the viewer's own terms. `mine` marks the steps that wait on the viewer. */
function nextStep(d: D, u: User): { text: string; mine: boolean } {
  if (d.stage === 'lost') return { text: 'Ended', mine: false };
  if (d.stage === 'closed') return { text: 'Closed', mine: false };
  if (d.stage === 'inspection' || d.stage === 'escrow') return { text: u.role === 'admin' ? 'Yours to move forward' : 'With Gridstock', mine: u.role === 'admin' };
  if (u.id !== d.buyer_id && u.id !== d.seller_id) return { text: 'With the two sides', mine: false };
  if (d.stage === 'nda') {
    const signed = u.id === d.buyer_id ? d.buyer_nda_at : d.seller_nda_at;
    return signed ? { text: 'Waiting for the other side', mine: false } : { text: 'Accept the NDA', mine: true };
  }
  if (d.offer_price == null) return { text: 'Make an offer', mine: true };
  return d.offer_by === u.id ? { text: 'Waiting for a reply', mine: false } : { text: 'Answer the offer', mine: true };
}

export default async function Deals() {
  const u = await requireUser();
  const rows = await q<D>(
    `select d.id, d.stage, d.offer_price, d.offer_by, d.buyer_nda_at, d.seller_nda_at, d.updated_at, l.category, l.oem, l.model,
            l.voltage_v, l.secondary_v, l.amps, l.capacity, l.kaic, l.enclosure, r.buyer_id, l.seller_id
     from deals d join matches m on m.id = d.match_id join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
     where $1 in (l.seller_id, r.buyer_id) or $2 = 'admin' order by (d.stage = 'lost'), d.updated_at desc`, [u.id, u.role]);
  return (
    <>
      <div className="head">
        <div>
          <h1>Deals</h1>
          <p>Every deal moves through NDA, documents, offer, independent inspection and escrow.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="blank">No deals yet. A deal room opens when a buyer asks for an intro on a match, or a seller proposes one.</p>
      ) : (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Equipment</th><th className="wide-only">Rating</th><th>Stage</th><th>Next step</th><th className="wide-only">Offer</th><th className="wide-only">Updated</th></tr>
            </thead>
            <tbody>
              {rows.map(d => {
                const step = nextStep(d, u);
                return (
                  <tr key={d.id}>
                    <td className="lead-cell">
                      <Link href={`/deals/${d.id}`}>{d.oem} {d.model ?? ''}</Link>
                      <div className="under">{cat(d.category)}</div>
                    </td>
                    <td className="wide-only"><Spec x={d} /></td>
                    <td>{STAGE_LABEL[d.stage]}</td>
                    <td>{step.mine ? <span className="state live">{step.text}</span> : <span className="soft">{step.text}</span>}</td>
                    <td className="wide-only num">{d.offer_price == null ? <span className="soft">None yet</span> : money(d.offer_price)}</td>
                    <td className="wide-only num">{day(d.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
