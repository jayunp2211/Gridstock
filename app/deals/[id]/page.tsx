import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS, STAGES, STAGE_LABEL, label, money, date, specLine } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { acceptNda, makeOffer, postMessage, setStage } from '../../actions';

export const dynamic = 'force-dynamic';

type D = {
  id: string; stage: string; buyer_nda_at: string | null; seller_nda_at: string | null; offer_price: number | null; fee_pct: string;
  score: number; gaps: Gap[]; request_id: string; buyer_id: string; seller_id: string;
  category: string; oem: string; model: string | null; voltage_v: number; amps: number; kaic: number | null; enclosure: string | null;
  condition: string; quantity: number; location_state: string; available_date: string; asking_price: number | null;
  warranty_status: string | null; notes: string | null; standard: string | null;
  buyer_name: string; buyer_company: string; seller_name: string; seller_company: string; need_by: string; site_state: string;
};
type Msg = { id: string; body: string; created_at: string; name: string | null; company: string | null; author_id: string | null };

export default async function DealRoom({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await one<D>(
    `select d.*, m.score, m.gaps, m.request_id, r.buyer_id, l.seller_id, l.category, l.oem, l.model, l.voltage_v, l.amps, l.kaic,
            l.enclosure, l.condition, l.quantity, l.location_state, l.available_date, l.asking_price, l.warranty_status, l.notes, l.standard,
            b.name as buyer_name, b.company as buyer_company, s.name as seller_name, s.company as seller_company, r.need_by, r.site_state
     from deals d join matches m on m.id = d.match_id join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
     join users b on b.id = r.buyer_id join users s on s.id = l.seller_id where d.id = $1`, [id]);
  if (!d) notFound();
  const isBuyer = u.id === d.buyer_id, isSeller = u.id === d.seller_id, isAdmin = u.role === 'admin';
  if (!isBuyer && !isSeller && !isAdmin) notFound();
  const ndaDone = !!(d.buyer_nda_at && d.seller_nda_at);
  const reveal = ndaDone || isAdmin;
  const myNda = isBuyer ? d.buyer_nda_at : isSeller ? d.seller_nda_at : 'n/a';
  const msgs = await q<Msg>(
    `select dm.id, dm.body, dm.created_at, dm.author_id, u.name, u.company from deal_messages dm left join users u on u.id = dm.author_id
     where dm.deal_id = $1 order by dm.created_at`, [id]);
  const who = (m: Msg) => {
    if (!m.author_id) return 'Gridstock';
    if (m.author_id === u.id) return 'You';
    if (m.author_id === d.buyer_id) return reveal ? `${m.name} (${m.company})` : 'Buyer';
    if (m.author_id === d.seller_id) return reveal ? `${m.name} (${m.company})` : 'Seller';
    return 'Gridstock ops';
  };
  const stageIdx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const fee = d.offer_price ? Math.round(d.offer_price * Number(d.fee_pct) / 100) : null;

  return (
    <>
      <Link href="/deals" className="small">← Deals</Link>
      <h1>{d.oem} {d.model ?? ''} · {label(CATEGORIES, d.category)}</h1>
      <p className="lead">{specLine(d)} · {label(CONDITIONS, d.condition)} · qty {d.quantity} · fit {d.score}/100</p>
      <div className="stages">
        {STAGES.map((s, i) => <span key={s} className={`pill ${s === d.stage ? 'on' : i < stageIdx ? 'done' : ''}`}>{i < stageIdx ? '✓ ' : ''}{STAGE_LABEL[s]}</span>)}
        {d.stage === 'lost' && <span className="pill on">Lost</span>}
      </div>

      {!ndaDone && (
        <div className="card">
          <strong>Mutual NDA with non-circumvention</strong>
          <p className="muted small">Both parties agree to keep project and pricing details confidential, and that any purchase arising from this introduction within 12 months closes through Gridstock. Identities and asking price are revealed once both sides accept.</p>
          <p className="small">Buyer: {d.buyer_nda_at ? `accepted ${date(d.buyer_nda_at)}` : 'pending'} · Seller: {d.seller_nda_at ? `accepted ${date(d.seller_nda_at)}` : 'pending'}</p>
          {!myNda && <form action={acceptNda}><input type="hidden" name="deal_id" value={d.id} /><button>Accept NDA</button></form>}
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Parties</h2>
          <p className="small">Buyer: {reveal || isBuyer ? `${d.buyer_name}, ${d.buyer_company}` : 'Hidden until NDA'} · site {d.site_state} · need by {date(d.need_by)}</p>
          <p className="small">Seller: {reveal || isSeller ? `${d.seller_name}, ${d.seller_company}` : 'Hidden until NDA'} · ships from {d.location_state} · available {date(d.available_date)}</p>
          <h2>Fit</h2>
          <ul className="gaps">{d.gaps.map((g, i) => <li key={i} className={g.severity}>{g.text}</li>)}</ul>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Commercials</h2>
          <p className="small">Asking: {reveal || isSeller ? money(d.asking_price) : 'Shown after NDA'}</p>
          <p className="small">Current offer: {money(d.offer_price)}{fee != null && (isAdmin || isBuyer) ? ` · Gridstock fee ${d.fee_pct}% = ${money(fee)}` : ''}</p>
          <p className="small">Standard: {d.standard ?? '—'} · Warranty: {d.warranty_status ?? '—'}</p>
          {d.notes && reveal && <p className="small muted">{d.notes}</p>}
          {ndaDone && d.stage !== 'closed' && d.stage !== 'lost' && (
            <form action={makeOffer} className="row" style={{ justifyContent: 'flex-start' }}>
              <input type="hidden" name="deal_id" value={d.id} />
              <input name="offer_price" inputMode="numeric" placeholder="Offer in USD" required />
              <button className="secondary">{isSeller ? 'Counter' : 'Make offer'}</button>
            </form>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <strong>Ops: move stage</strong>
          <form action={setStage} className="row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
            <input type="hidden" name="deal_id" value={d.id} />
            <select name="stage" defaultValue={d.stage}>{[...STAGES, 'lost'].map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            <button className="secondary">Update</button>
          </form>
        </div>
      )}

      <h2>Deal room</h2>
      {msgs.length === 0 && <p className="muted small">No messages yet. {ndaDone ? 'Share submittals, test reports and photos here.' : 'Messages open once both sides accept the NDA.'}</p>}
      {msgs.map(m => <div key={m.id} className="msg"><div className="meta">{who(m)} · {new Date(m.created_at).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>{m.body}</div>)}
      {(ndaDone || isAdmin) && (
        <form action={postMessage} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="deal_id" value={d.id} />
          <textarea name="body" placeholder="Message, or links to submittals and test reports" required />
          <div><button>Send</button></div>
        </form>
      )}
    </>
  );
}
