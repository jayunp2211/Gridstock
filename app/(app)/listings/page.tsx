import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money, date } from '@/lib/labels';
import { Specs, Status, cat } from '@/components/ui';

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
      <div className="page-head">
        <div>
          <span className="eyebrow">Seller</span>
          <h1>My listings</h1>
          <p className="lead">Buyers see the specs, never your company or project, until both sides sign the NDA.</p>
        </div>
        <Link href="/listings/new" className="btn primary">List gear</Link>
      </div>
      {created && <div className="notice">Listing saved and matched against open buyer requests.</div>}
      {rows.length === 0 && <div className="empty">No listings yet. List your first lineup to see which builders need it.</div>}
      {rows.map(l => (
        <div key={l.id} className="card row top-align">
          <div className="grow">
            <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <span className="title">{l.oem} {l.model ?? ''}</span><Status value={l.status} />
            </div>
            <div className="meta">{cat(l.category)} · ships from {l.location_state} · available {date(l.available_date)}</div>
            <Specs x={l} />
          </div>
          <div className="right">
            <div className="price">{money(l.asking_price)}</div>
            <div className="meta">{l.matches} matched {l.matches === 1 ? 'request' : 'requests'} · {l.deals} {l.deals === 1 ? 'deal' : 'deals'}</div>
          </div>
        </div>
      ))}
    </>
  );
}
