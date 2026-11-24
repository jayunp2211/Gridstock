import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money, units } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { syncRequest } from '@/lib/matching';
import { filled, taken } from '@/lib/units';
import { requestIntro, setRequestStatus } from '@/app/actions';
import { Spec, Fit, Checks, Arrow, cat, day } from '@/components/ui';

export const metadata = { title: 'Request' };

export const dynamic = 'force-dynamic';

type Req = { id: string; buyer_id: string; category: string; voltage_v: number; secondary_v: number | null; amps_min: number | null;
  capacity_min: number | null; kaic_min: number | null;
  enclosure: string | null; acceptable_oems: string[]; quantity: number; site_state: string; need_by: string; status: string;
  budget_max: number | null;
  /** Units of the need that no accepted deal covers yet. */
  open_need: number };
type M = { id: string; score: number; gaps: Gap[]; category: string; oem: string; model: string | null; voltage_v: number;
  secondary_v: number | null; amps: number | null; capacity: number | null; kaic: number | null; configuration: string | null; enclosure: string | null; standard: string | null; condition: string; quantity: number; location_state: string;
  available_date: string; deal_id: string | null; deal_stage: string | null; seller_verified: boolean; listing_status: string };

const TAKEN: Record<string, string> = { under_offer: 'Every unit is reserved in other deals', sold: 'Sold' };

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser('buyer');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await one<Req>(`select r.*, r.quantity - ${filled('r')} as open_need from requests r where r.id = $1`, [id]);
  if (!r || (r.buyer_id !== u.id && u.role !== 'admin')) notFound();
  await syncRequest(id);
  // Buyers see ratings and the seller's own description of the configuration: no seller name, company or asking price before the NDA.
  const matches = await q<M>(
    `select m.id, m.score, m.gaps, l.category, l.oem, l.model, l.voltage_v, l.secondary_v, l.amps, l.capacity, l.kaic, l.configuration,
            l.enclosure, l.standard, l.condition,
            case when l.status = 'active' then l.quantity - ${taken('l')} else l.quantity end as quantity,
            l.location_state, l.available_date, l.status as listing_status, d.id as deal_id, d.stage as deal_stage, s.verified as seller_verified
     from matches m join listings l on l.id = m.listing_id join users s on s.id = l.seller_id
     left join deals d on d.match_id = m.id
     where m.request_id = $1 and (l.status <> 'withdrawn' or d.id is not null) order by m.score desc, l.available_date`, [id]);
  const mine = r.buyer_id === u.id;
  const covered = r.quantity - Math.max(0, r.open_need);
  return (
    <>
      <Link href="/requests" className="back"><Arrow />My requests</Link>
      <div className="head">
        <div>
          <h1>{cat(r.category)} for a site in {r.site_state}</h1>
          <p>
            Needed by {day(r.need_by)}.{' '}
            {r.acceptable_oems.length ? `Acceptable OEMs: ${r.acceptable_oems.join(', ')}.` : 'Any OEM.'}
            {r.budget_max != null && ` Budget ceiling ${money(r.budget_max)}, which sellers never see.`}
          </p>
          <Spec x={r} full />
        </div>
        {mine && (r.status === 'open' || r.status === 'closed') && (
          <form action={setRequestStatus}>
            <input type="hidden" name="request_id" value={r.id} />
            <input type="hidden" name="to" value={r.status === 'open' ? 'closed' : 'open'} />
            <button className="line">{r.status === 'open' ? 'Close request' : 'Reopen request'}</button>
          </form>
        )}
      </div>
      {r.status === 'closed' && <div className="notice" role="status">This request is closed. Sellers no longer see it, and it is not being matched.</div>}
      {r.status === 'in_deal' && <div className="notice" role="status">Accepted offers cover everything this request needs, so matching is paused while those deals complete.</div>}
      {r.status === 'open' && covered > 0 && (
        <div className="notice" role="status">Accepted offers cover {covered} of the {units(r.quantity)} you need. The request stays open for the other {r.quantity - covered}.</div>
      )}

      <h2>{matches.length === 0 ? 'No matching listings yet' : `${matches.length} matching ${matches.length === 1 ? 'listing' : 'listings'}, best fit first`}</h2>
      {matches.length === 0
        ? <p className="blank">{r.status === 'open' ? 'You will get a notification when matching gear is listed.' : 'Matching is paused while the request is not open.'}</p>
        : <p className="lede soft">Fit is a first screen on nameplate ratings. It does not replace a review of the single-line diagram and submittals, which you get in the deal room once both sides sign the NDA.</p>}
      <div className="matches">
        {matches.map(m => (
          <article key={m.id} className="match">
            <Fit value={m.score} />
            <div>
              <h3>{m.oem} {m.model ?? ''}</h3>
              <Spec x={m} full />
              {m.configuration && <p className="config">{m.configuration}</p>}
              <p className="where">
                Ships from {m.location_state}, available {day(m.available_date)}.
                {m.seller_verified ? ' Seller verified by Gridstock.' : ''}
                {!m.deal_id && TAKEN[m.listing_status] ? ` ${TAKEN[m.listing_status]}.` : ''}
              </p>
              <Checks gaps={m.gaps} />
            </div>
            <div className="act">
              {m.deal_id ? <Link href={`/deals/${m.deal_id}`} className="btn line">{m.deal_stage === 'lost' ? 'See ended deal' : 'Open deal room'}<Arrow /></Link>
                : mine && r.status === 'open' && m.listing_status === 'active'
                  ? <form action={requestIntro}><input type="hidden" name="match_id" value={m.id} /><button className="go">Request intro<Arrow /></button></form>
                  : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
