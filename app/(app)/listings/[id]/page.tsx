import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money, units } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { syncListing } from '@/lib/matching';
import { filled, sold, taken } from '@/lib/units';
import { proposeIntro, setListingStatus } from '@/app/actions';
import { Spec, Fit, Checks, State, Arrow, cat, day } from '@/components/ui';

export const metadata = { title: 'Listing' };

export const dynamic = 'force-dynamic';

type L = { id: string; seller_id: string; category: string; oem: string; model: string | null; voltage_v: number; secondary_v: number | null;
  amps: number | null; capacity: number | null; kaic: number | null; configuration: string | null; enclosure: string | null; standard: string | null; condition: string; quantity: number; location_state: string;
  available_date: string; asking_price: number | null; warranty_status: string | null; notes: string | null; status: string;
  /** Units no accepted deal has taken, and units in deals that have closed. */
  open_units: number; sold_units: number };
type M = { id: string; score: number; gaps: Gap[]; category: string; voltage_v: number; secondary_v: number | null; amps_min: number | null;
  capacity_min: number | null; kaic_min: number | null;
  enclosure: string | null; quantity: number; site_state: string; need_by: string; request_status: string; deal_id: string | null;
  deal_stage: string | null; buyer_verified: boolean };

export default async function ListingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const u = await requireUser('seller');
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const l = await one<L>(`select l.*, l.quantity - ${taken('l')} as open_units, ${sold('l')} as sold_units from listings l where l.id = $1`, [id]);
  if (!l || (l.seller_id !== u.id && u.role !== 'admin')) notFound();
  await syncListing(id);
  // Sellers see the need, never the buyer: no name, company, budget or project notes before the NDA.
  const reqs = await q<M>(
    `select m.id, m.score, m.gaps, r.category, r.voltage_v, r.secondary_v, r.amps_min, r.capacity_min, r.kaic_min, r.enclosure,
            case when r.status = 'open' then r.quantity - ${filled('r')} else r.quantity end as quantity,
            r.site_state, r.need_by,
            r.status as request_status, d.id as deal_id, d.stage as deal_stage, b.verified as buyer_verified
     from matches m join requests r on r.id = m.request_id join users b on b.id = r.buyer_id left join deals d on d.match_id = m.id
     where m.listing_id = $1 and (r.status = 'open' or d.id is not null) order by m.score desc, r.need_by`, [id]);
  const each = l.asking_price != null && l.quantity > 1 ? Math.round(l.asking_price / l.quantity) : null;
  const open = Math.max(0, l.open_units), reserved = l.quantity - open - l.sold_units;
  return (
    <>
      <Link href="/listings" className="back"><Arrow />My listings</Link>
      <div className="head">
        <div>
          <h1>{l.oem} {l.model ?? ''}</h1>
          <p>{cat(l.category)}. Ships from {l.location_state}, available {day(l.available_date)}.</p>
          <Spec x={l} full />
        </div>
        {l.seller_id === u.id && (l.status === 'active' || l.status === 'withdrawn') && (
          <form action={setListingStatus}>
            <input type="hidden" name="listing_id" value={l.id} />
            <input type="hidden" name="to" value={l.status === 'active' ? 'withdrawn' : 'active'} />
            <button className="line">{l.status === 'active' ? 'Withdraw listing' : 'List it again'}</button>
          </form>
        )}
      </div>
      {created && <div className="notice" role="status">Listing saved and matched against open buyer requests.</div>}
      {l.status === 'withdrawn' && <div className="notice" role="status">This listing is withdrawn. Buyers no longer see it, and it is not being matched.</div>}

      <dl className="facts terms">
        <dt>Status</dt><dd><State value={l.status} /></dd>
        {(l.quantity > 1 || open < l.quantity) && (
          <>
            <dt>Units</dt>
            <dd>
              {open === l.quantity ? `${units(l.quantity)}, all open to buyers` : `${open} of ${l.quantity} open to buyers`}
              {open < l.quantity && (
                <div className="soft small">
                  {[reserved > 0 ? `${reserved} reserved while ${reserved === 1 ? 'a deal completes' : 'deals complete'}` : null, l.sold_units > 0 ? `${l.sold_units} sold` : null]
                    .filter(Boolean).join(', ')}.
                  {' '}An accepted offer takes only the units in that deal.
                </div>
              )}
            </dd>
          </>
        )}
        <dt>Asking</dt>
        <dd>
          {l.asking_price == null ? <span className="soft">Not set</span> : <span className="big num">{money(l.asking_price)}</span>}
          {l.asking_price != null && <div className="soft small">For {l.quantity === 1 ? 'the unit' : `all ${units(l.quantity)}`}{each != null && `, ${money(each)} each`}. Buyers see it only after the NDA.</div>}
        </dd>
        <dt>Configuration</dt>
        <dd>{l.configuration ?? <span className="soft">Not described</span>}<div className="soft small">Matched buyers see this before the NDA.</div></dd>
        <dt>Warranty</dt><dd>{l.warranty_status ?? <span className="soft">Not stated</span>}</dd>
        {l.notes && <><dt>Notes</dt><dd>{l.notes}<div className="soft small">Shown to a buyer only after the NDA.</div></dd></>}
      </dl>

      <h2>{reqs.length === 0 ? 'No matching requests yet' : `${reqs.length} matching ${reqs.length === 1 ? 'request' : 'requests'}, best fit first`}</h2>
      {reqs.length === 0
        ? <p className="blank">{l.status === 'active' ? 'You will get a notification when a builder posts a need this gear fits.' : 'Matching is paused while the listing is not active.'}</p>
        : <p className="lede soft">Fit is a first screen on nameplate ratings. Propose an intro to open a deal room. The buyer learns who you are only after both of you sign the NDA.</p>}
      <div className="matches">
        {reqs.map(m => (
          <article key={m.id} className="match">
            <Fit value={m.score} />
            <div>
              <h3>{cat(m.category)} for a site in {m.site_state}</h3>
              <Spec x={m} full />
              <p className="where">
                Needed by {day(m.need_by)}.
                {m.buyer_verified ? ' Buyer verified by Gridstock.' : ''}
                {!m.deal_id && m.request_status !== 'open' ? ' No longer open.' : ''}
              </p>
              <Checks gaps={m.gaps} />
            </div>
            <div className="act">
              {m.deal_id ? <Link href={`/deals/${m.deal_id}`} className="btn line">{m.deal_stage === 'lost' ? 'See ended deal' : 'Open deal room'}</Link>
                : l.status === 'active' && m.request_status === 'open' && l.seller_id === u.id
                  ? <form action={proposeIntro}><input type="hidden" name="match_id" value={m.id} /><button className="go">Propose intro</button></form>
                  : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
