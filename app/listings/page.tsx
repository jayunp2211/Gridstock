import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS, label, money, date, specLine } from '@/lib/labels';

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
      <div className="row"><div><h1>My listings</h1><p className="lead">Listings are private: buyers see the specs, never your company or project, until both sides sign the NDA.</p></div>
        <Link href="/listings/new"><button>List gear</button></Link></div>
      {created && <div className="notice">Listing saved. We matched it against open buyer requests.</div>}
      {rows.length === 0 && <p className="muted">No listings yet.</p>}
      {rows.map(l => (
        <div key={l.id} className="card row">
          <div>
            <strong>{l.oem} {l.model ?? ''} · {label(CATEGORIES, l.category)}</strong> <span className="pill">{l.status.replace('_', ' ')}</span>
            <div className="muted small">{specLine(l)} · {label(CONDITIONS, l.condition)} · qty {l.quantity} · {l.location_state} · available {date(l.available_date)}</div>
          </div>
          <div className="small" style={{ textAlign: 'right' }}>
            <div>{money(l.asking_price)}</div>
            <div className="muted">{l.matches} matched requests · {l.deals} deals</div>
          </div>
        </div>
      ))}
    </>
  );
}
