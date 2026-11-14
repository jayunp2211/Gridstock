import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money } from '@/lib/labels';
import { Spec, State, Arrow, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; category: string; oem: string; model: string | null; voltage_v: number; amps: number; kaic: number | null;
  enclosure: string | null; condition: string; quantity: number; location_state: string; available_date: string;
  asking_price: number | null; status: string; matches: number; deals: number;
};

export default async function Listings({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const u = await requireUser('seller');
  const { created } = await searchParams;
  const rows = await q<Row>(
    `select l.*, (select count(*)::int from matches m where m.listing_id = l.id) as matches,
            (select count(*)::int from deals d join matches m on m.id = d.match_id where m.listing_id = l.id) as deals
     from listings l where l.seller_id = $1 order by l.created_at desc`, [u.id]);
  return (
    <>
      <div className="head">
        <div>
          <h1>My listings</h1>
          <p>Buyers see the ratings, never your company or project, until both sides sign the NDA.</p>
        </div>
        <Link href="/listings/new" className="btn go">List gear<Arrow /></Link>
      </div>
      {created && <div className="notice" role="status">Listing saved and matched against open buyer requests.</div>}
      {rows.length === 0 ? (
        <p className="blank">No listings yet. List your first lineup to see which builders need it.</p>
      ) : (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><th>Equipment</th><th className="wide-only">Rating</th><th className="wide-only">Ships from</th><th>Asking</th><th>Interest</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(l => (
                <tr key={l.id}>
                  <td className="lead-cell">
                    {l.oem} {l.model ?? ''}
                    <div className="under">{cat(l.category)}<span className="narrow-only"><Spec x={l} /></span></div>
                  </td>
                  <td className="wide-only"><Spec x={l} full /></td>
                  <td className="wide-only">{l.location_state}, from {day(l.available_date)}</td>
                  <td className="num">{l.asking_price == null ? <span className="soft">Not set</span> : money(l.asking_price)}</td>
                  <td>{l.matches} {l.matches === 1 ? 'match' : 'matches'}{l.deals > 0 && <>, <Link href="/deals">{l.deals} {l.deals === 1 ? 'deal' : 'deals'}</Link></>}</td>
                  <td><State value={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
