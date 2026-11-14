import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { syncRequest } from '@/lib/matching';
import { requestIntro, setRequestStatus } from '@/app/actions';
import { Spec, Fit, Checks, Arrow, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Req = { id: string; buyer_id: string; category: string; voltage_v: number; amps_min: number; kaic_min: number | null;
  enclosure: string | null; acceptable_oems: string[]; quantity: number; site_state: string; need_by: string; status: string;
  budget_max: number | null };
type M = { id: string; score: number; gaps: Gap[]; oem: string; model: string | null; voltage_v: number; amps: number;
  kaic: number | null; enclosure: string | null; standard: string | null; condition: string; quantity: number; location_state: string;
  available_date: string; deal_id: string | null; deal_stage: string | null; seller_verified: boolean; listing_status: string };

const TAKEN: Record<string, string> = { under_offer: 'Under offer with another buyer', sold: 'Sold' };

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser('buyer');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await one<Req>('select * from requests where id = $1', [id]);
  if (!r || (r.buyer_id !== u.id && u.role !== 'admin')) notFound();
  await syncRequest(id);
  // Buyers see specs only: no seller name, company or asking price before NDA.
  const matches = await q<M>(
    `select m.id, m.score, m.gaps, l.oem, l.model, l.voltage_v, l.amps, l.kaic, l.enclosure, l.standard, l.condition, l.quantity,
            l.location_state, l.available_date, l.status as listing_status, d.id as deal_id, d.stage as deal_stage, s.verified as seller_verified
     from matches m join listings l on l.id = m.listing_id join users s on s.id = l.seller_id
     left join deals d on d.match_id = m.id
     where m.request_id = $1 and (l.status <> 'withdrawn' or d.id is not null) order by m.score desc, l.available_date`, [id]);
  const mine = r.buyer_id === u.id;
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
      {r.status === 'in_deal' && <div className="notice" role="status">An offer has been accepted on this request, so matching is paused.</div>}

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
