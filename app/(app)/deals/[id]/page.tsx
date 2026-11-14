import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { STAGES, STAGE_LABEL, money, date } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { acceptNda, makeOffer, postMessage, setStage } from '@/app/actions';
import { Specs, Score, cat } from '@/components/ui';

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
    if (m.author_id === d.buyer_id) return reveal ? `${m.name} · ${m.company}` : 'Buyer';
    if (m.author_id === d.seller_id) return reveal ? `${m.name} · ${m.company}` : 'Seller';
    return 'Gridstock ops';
  };
  const kind = (m: Msg) => (m.body.startsWith('Stage moved to') ? 'sys' : m.author_id === u.id ? 'me' : '');
  const stageIdx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const fee = d.offer_price ? Math.round(d.offer_price * Number(d.fee_pct) / 100) : null;
  const hidden = <span className="pill">Hidden until NDA</span>;

  return (
    <>
      <Link href="/deals" className="back">← Deals</Link>
      <div className="row top-align" style={{ flexWrap: 'nowrap' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <span className="eyebrow">Deal room · {cat(d.category)}</span>
          <h1>{d.oem} {d.model ?? ''}</h1>
          <Specs x={d} />
        </div>
        <Score value={d.score} />
      </div>

      <div className="stepper" aria-label="Deal stage">
        {STAGES.map((s, i) => <div key={s} className={`step ${s === d.stage ? 'now' : i < stageIdx ? 'done' : ''}`}>{STAGE_LABEL[s]}</div>)}
      </div>
      {d.stage === 'lost' && <div className="notice">This deal was marked lost.</div>}

      {!ndaDone && (
        <div className="card nda">
          <h3>Mutual NDA with non-circumvention</h3>
          <p className="small" style={{ margin: '0 0 14px' }}>Both parties agree to keep project and pricing details confidential, and that any purchase arising from this introduction within 12 months closes through Gridstock. Identities and asking price are revealed once both sides accept.</p>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <span className={`pill dot ${d.buyer_nda_at ? 'good' : ''}`}>Buyer {d.buyer_nda_at ? 'accepted' : 'pending'}</span>
            <span className={`pill dot ${d.seller_nda_at ? 'good' : ''}`}>Seller {d.seller_nda_at ? 'accepted' : 'pending'}</span>
            {!myNda && <form action={acceptNda} style={{ marginLeft: 'auto' }}><input type="hidden" name="deal_id" value={d.id} /><button className="primary">Accept NDA</button></form>}
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h2>Parties and fit</h2>
          <dl className="kv">
            <dt>Buyer</dt><dd>{reveal || isBuyer ? <>{d.buyer_name}<div className="muted small">{d.buyer_company}</div></> : hidden}</dd>
            <dt>Site</dt><dd>{d.site_state} · need by {date(d.need_by)}</dd>
            <dt>Seller</dt><dd>{reveal || isSeller ? <>{d.seller_name}<div className="muted small">{d.seller_company}</div></> : hidden}</dd>
            <dt>Ships from</dt><dd>{d.location_state} · available {date(d.available_date)}</dd>
          </dl>
          <ul className="gaps">{d.gaps.map((g, i) => <li key={i} className={g.severity}>{g.text}</li>)}</ul>
        </div>
        <div className="card">
          <h2>Commercials</h2>
          <dl className="kv">
            <dt>Asking</dt><dd className="price">{reveal || isSeller ? money(d.asking_price) : hidden}</dd>
            <dt>Offer</dt><dd className="price">{money(d.offer_price)}</dd>
            {fee != null && (isAdmin || isBuyer) && <><dt>Fee</dt><dd>{money(fee)} <span className="muted small">({Number(d.fee_pct)}% at close)</span></dd></>}
            <dt>Warranty</dt><dd>{d.warranty_status ?? '—'}</dd>
          </dl>
          {d.notes && reveal && <p className="small muted" style={{ margin: '16px 0 0' }}>{d.notes}</p>}
          {ndaDone && d.stage !== 'closed' && d.stage !== 'lost' && (
            <form action={makeOffer} className="inline-form" style={{ marginTop: 18 }}>
              <input type="hidden" name="deal_id" value={d.id} />
              <input name="offer_price" inputMode="numeric" placeholder="Offer in USD" required />
              <button className="secondary">{isSeller ? 'Counter' : 'Make offer'}</button>
            </form>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Ops: move stage</h3>
          <form action={setStage} className="inline-form">
            <input type="hidden" name="deal_id" value={d.id} />
            <select name="stage" defaultValue={d.stage}>{[...STAGES, 'lost'].map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            <button className="secondary">Update</button>
          </form>
        </div>
      )}

      <h2>Messages</h2>
      {msgs.length === 0 && <div className="empty">{ndaDone ? 'No messages yet. Share submittals, test reports and photos here.' : 'Messages open once both sides accept the NDA.'}</div>}
      <div className="thread">
        {msgs.map(m => (
          <div key={m.id} className={`msg ${kind(m)}`}>
            {kind(m) !== 'sys' && <div className="who-line">{who(m)} · {new Date(m.created_at).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>}
            {m.body}
          </div>
        ))}
      </div>
      {(ndaDone || isAdmin) && (
        <form action={postMessage} className="stack" style={{ marginTop: 18, maxWidth: 640 }}>
          <input type="hidden" name="deal_id" value={d.id} />
          <textarea name="body" placeholder="Message, or links to submittals and test reports" required />
          <div><button>Send</button></div>
        </form>
      )}
    </>
  );
}
