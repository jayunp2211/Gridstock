import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money } from '@/lib/labels';
import { syncListing } from '@/lib/matching';
import { taken } from '@/lib/units';
import { Spec, State, Arrow, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; category: string; oem: string; model: string | null; voltage_v: number; secondary_v: number | null; amps: number | null;
  capacity: number | null; kaic: number | null;
  enclosure: string | null; condition: string; quantity: number; location_state: string; available_date: string;
  asking_price: number | null; status: string; matches: number; deals: number; open_units: number;
};

export default async function Listings() {
  const u = await requireUser('seller');
  const mine = await q<{ id: string }>(`select id from listings where seller_id = $1 and status = 'active'`, [u.id]);
  for (const l of mine) await syncListing(l.id);
  const rows = await q<Row>(
    `select l.*, l.quantity - ${taken('l')} as open_units,
            (select count(*)::int from matches m join requests r on r.id = m.request_id where m.listing_id = l.id and r.status = 'open') as matches,
            (select count(*)::int from deals d join matches m on m.id = d.match_id where m.listing_id = l.id and d.stage <> 'lost') as deals
     from listings l where l.seller_id = $1 order by l.created_at desc`, [u.id]);
  return (
    <>
      <div className="head">
        <div>
          <h1>My listings</h1>
          <p>Buyers see the ratings, never your company or project, until both sides sign the NDA. Open a listing to see who needs it.</p>
        </div>
        <Link href="/listings/new" className="btn go">List gear<Arrow /></Link>
      </div>
      {rows.length === 0 ? (
        <p className="blank">No listings yet. List your first lineup to see which builders need it.</p>
      ) : (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Equipment</th><th className="wide-only">Rating</th><th className="wide-only">Ships from</th><th>Asking</th><th>Demand</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(l => (
                <tr key={l.id}>
                  <td className="lead-cell">
                    <Link href={`/listings/${l.id}`}>{l.oem} {l.model ?? ''}</Link>
                    <div className="under">{cat(l.category)}<span className="narrow-only"><Spec x={l} /></span></div>
                  </td>
                  <td className="wide-only"><Spec x={l} full /></td>
                  <td className="wide-only">{l.location_state}, from {day(l.available_date)}</td>
                  <td className="num">
                    {l.asking_price == null ? <span className="soft">Not set</span> : money(l.asking_price)}
                    {l.asking_price != null && l.quantity > 1 && <div className="under">{money(Math.round(l.asking_price / l.quantity))} each</div>}
                  </td>
                  <td>
                    {l.matches === 0 && l.deals === 0 ? <span className="soft">None yet</span> : <>{l.matches} {l.matches === 1 ? 'request' : 'requests'}</>}
                    {l.deals > 0 && <div className="under"><Link href="/deals">{l.deals} {l.deals === 1 ? 'deal' : 'deals'}</Link></div>}
                  </td>
                  <td>
                    <State value={l.status} />
                    {l.status === 'active' && l.open_units < l.quantity && <div className="under">{Math.max(0, l.open_units)} of {l.quantity} open</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
