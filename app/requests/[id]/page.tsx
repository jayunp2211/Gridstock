import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS, label, date, specLine } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { requestIntro } from '../../actions';

export const dynamic = 'force-dynamic';

type Req = { id: string; buyer_id: string; category: string; voltage_v: number; amps_min: number; kaic_min: number | null;
  enclosure: string | null; acceptable_oems: string[]; quantity: number; site_state: string; need_by: string; status: string };
type M = { id: string; score: number; gaps: Gap[]; oem: string; model: string | null; voltage_v: number; amps: number;
  kaic: number | null; enclosure: string | null; condition: string; quantity: number; location_state: string;
  available_date: string; deal_id: string | null; seller_verified: boolean; listing_status: string };

const tone = (s: number) => (s >= 80 ? 'hi' : s >= 60 ? 'mid' : 'lo');

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
      <Link href="/requests" className="small">← My requests</Link>
      <h1>{label(CATEGORIES, r.category)} · qty {r.quantity}</h1>
      <p className="lead">{specLine(r)} · site {r.site_state} · need by {date(r.need_by)}
        {r.acceptable_oems.length > 0 && <> · OEMs: {r.acceptable_oems.join(', ')}</>}</p>
      <h2>{matches.length} matching {matches.length === 1 ? 'listing' : 'listings'}</h2>
      {matches.length === 0 && <p className="muted">No matches yet. We will notify you when matching gear is listed.</p>}
      {matches.map(m => (
        <div key={m.id} className="card">
          <div className="row">
            <div className={`score ${tone(m.score)}`}>{m.score}</div>
            <div style={{ flex: 1 }}>
              <strong>{m.oem} {m.model ?? ''}</strong>{' '}
              {m.seller_verified && <span className="pill on">verified seller</span>}{' '}
              {m.listing_status !== 'active' && <span className="pill">{m.listing_status.replace('_', ' ')}</span>}
              <div className="muted small">{specLine(m)} · {label(CONDITIONS, m.condition)} · qty {m.quantity} · ships from {m.location_state} · available {date(m.available_date)}</div>
              <ul className="gaps">{m.gaps.map((g, i) => <li key={i} className={g.severity}>{g.text}</li>)}</ul>
            </div>
            <div>
              {m.deal_id ? <Link href={`/deals/${m.deal_id}`}><button className="secondary">Open deal room</button></Link>
                : <form action={requestIntro}><input type="hidden" name="match_id" value={m.id} /><button>Request intro</button></form>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
