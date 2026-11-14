import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { Gap } from '@/lib/match';
import { requestIntro } from '@/app/actions';
import { Spec, Fit, Checks, Arrow, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Req = { id: string; buyer_id: string; category: string; voltage_v: number; amps_min: number; kaic_min: number | null;
  enclosure: string | null; acceptable_oems: string[]; quantity: number; site_state: string; need_by: string; status: string };
type M = { id: string; score: number; gaps: Gap[]; oem: string; model: string | null; voltage_v: number; amps: number;
  kaic: number | null; enclosure: string | null; condition: string; quantity: number; location_state: string;
  available_date: string; deal_id: string | null; seller_verified: boolean; listing_status: string };

const TAKEN: Record<string, string> = { under_offer: 'Under offer with another buyer', sold: 'Sold' };

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser('buyer');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await one<Req>('select * from requests where id = $1', [id]);
  if (!r || (r.buyer_id !== u.id && u.role !== 'admin')) notFound();
  // Buyers see specs only: no seller name, company or asking price before NDA.
  const matches = await q<M>(
    `select m.id, m.score, m.gaps, l.oem, l.model, l.voltage_v, l.amps, l.kaic, l.enclosure, l.condition, l.quantity,
            l.location_state, l.available_date, l.status as listing_status, d.id as deal_id, s.verified as seller_verified
     from matches m join listings l on l.id = m.listing_id join users s on s.id = l.seller_id
     left join deals d on d.match_id = m.id
     where m.request_id = $1 and l.status <> 'withdrawn' order by m.score desc, l.available_date`, [id]);
  return (
    <>
      <Link href="/requests" className="back"><Arrow />My requests</Link>
      <div className="head">
        <div>
          <h1>{cat(r.category)} for a site in {r.site_state}</h1>
          <p>
            Needed by {day(r.need_by)}.{' '}
            {r.acceptable_oems.length ? `Acceptable OEMs: ${r.acceptable_oems.join(', ')}.` : 'Any OEM.'}
          </p>
          <Spec x={r} full />
        </div>
      </div>
      <h2>{matches.length === 0 ? 'No matching listings yet' : `${matches.length} matching ${matches.length === 1 ? 'listing' : 'listings'}, best fit first`}</h2>
      {matches.length === 0 && <p className="blank">You will get a notification when matching gear is listed.</p>}
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
              {m.deal_id ? <Link href={`/deals/${m.deal_id}`} className="btn line">Open deal room<Arrow /></Link>
                : <form action={requestIntro}><input type="hidden" name="match_id" value={m.id} /><button className="go">Request intro<Arrow /></button></form>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
