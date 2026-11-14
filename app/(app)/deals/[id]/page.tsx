import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { STAGES, STAGE_LABEL, money } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { acceptNda, acceptOffer, makeOffer, postMessage, setStage } from '@/app/actions';
import { Spec, Fit, Checks, Arrow, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

type D = {
  id: string; stage: string; buyer_nda_at: string | null; seller_nda_at: string | null; offer_price: number | null; fee_pct: string;
  offer_by: string | null; offer_accepted_at: string | null;
  score: number; gaps: Gap[]; request_id: string; buyer_id: string; seller_id: string;
  category: string; oem: string; model: string | null; voltage_v: number; amps: number; kaic: number | null; enclosure: string | null;
  condition: string; quantity: number; location_state: string; available_date: string; asking_price: number | null;
  warranty_status: string | null; notes: string | null; standard: string | null;
  buyer_name: string; buyer_company: string; seller_name: string; seller_company: string; need_by: string; site_state: string;
};
type Msg = { id: string; body: string; created_at: string; name: string | null; company: string | null; author_id: string | null };

const stamp = (d: string) =>
  new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';

export default async function DealRoom({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ offer?: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const { offer: offerError } = await searchParams;
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
    if (m.author_id === d.buyer_id) return reveal ? `${m.name}, ${m.company}` : 'Buyer';
    if (m.author_id === d.seller_id) return reveal ? `${m.name}, ${m.company}` : 'Seller';
    return 'Gridstock operations';
  };
  const isEvent = (m: Msg) => m.body.startsWith('Stage moved to');
  const stageIdx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const fee = d.offer_price ? Math.round(d.offer_price * Number(d.fee_pct) / 100) : null;
  const hidden = <span className="soft">Hidden until NDA</span>;
  // Offers: either party can make one after the NDA; only the side that received it can accept.
  const party = isBuyer || isSeller;
  const accepted = !!d.offer_accepted_at;
  const negotiable = ndaDone && !accepted && ['documents', 'offer'].includes(d.stage);
  const mine = d.offer_by === u.id;
  const from = d.offer_by === d.buyer_id ? 'buyer' : d.offer_by === d.seller_id ? 'seller' : null;
  const canAccept = party && negotiable && d.offer_price != null && from != null && !mine;
  const offerNote = d.offer_price == null ? null
    : !negotiable ? (from ? `From the ${from}.` : null)
    : mine ? `Your offer. Waiting for the ${isBuyer ? 'seller' : 'buyer'} to accept or counter.`
    : from ? `From the ${from}.${canAccept ? ' Accept it or counter below.' : ''}` : null;

  return (
    <>
      <Link href="/deals" className="back"><Arrow />Deals</Link>
      <div className="dealtop">
        <div>
          <h1>{d.oem} {d.model ?? ''}</h1>
          <Spec x={d} full />
          <p className="soft">{cat(d.category)}</p>
        </div>
        <Fit value={d.score} />
      </div>

      <ol className="stages" aria-label="Deal stage">
        {STAGES.map((s, i) => (
          <li key={s} className={s === d.stage ? 'now' : i < stageIdx ? 'done' : ''} aria-current={s === d.stage ? 'step' : undefined}>{STAGE_LABEL[s]}</li>
        ))}
      </ol>
      {d.stage === 'lost' && <div className="notice" role="status">This deal was marked lost.</div>}

      {!ndaDone && (
        <section className="panel nda">
          <div>
            <h3>Mutual NDA with non-circumvention</h3>
            <p>Both parties agree to keep project and pricing details confidential, and that any purchase arising from this introduction within 12 months closes through Gridstock. Identities and asking price are revealed once both sides accept.</p>
          </div>
          <div className="nda-side">
            <ul>
              <li className={d.buyer_nda_at ? 'state live' : 'state'}>Buyer {d.buyer_nda_at ? 'accepted' : 'has not accepted yet'}</li>
              <li className={d.seller_nda_at ? 'state live' : 'state'}>Seller {d.seller_nda_at ? 'accepted' : 'has not accepted yet'}</li>
            </ul>
            {!myNda && <form action={acceptNda}><input type="hidden" name="deal_id" value={d.id} /><button className="go">Accept NDA<Arrow /></button></form>}
          </div>
        </section>
      )}

      <div className="pair">
        <section>
          <h2>Parties and fit</h2>
          <dl className="facts">
            <dt>Buyer</dt><dd>{reveal || isBuyer ? <>{d.buyer_name}<div className="soft small">{d.buyer_company}</div></> : hidden}</dd>
            <dt>Site</dt><dd>{d.site_state}, needed by {day(d.need_by)}</dd>
            <dt>Seller</dt><dd>{reveal || isSeller ? <>{d.seller_name}<div className="soft small">{d.seller_company}</div></> : hidden}</dd>
            <dt>Ships from</dt><dd>{d.location_state}, available {day(d.available_date)}</dd>
          </dl>
          <Checks gaps={d.gaps} />
        </section>
        <section>
          <h2>Commercials</h2>
          <dl className="facts">
            <dt>Asking</dt><dd className={(reveal || isSeller) && d.asking_price != null ? 'big num' : ''}>{reveal || isSeller ? (d.asking_price == null ? <span className="soft">Not set</span> : money(d.asking_price)) : hidden}</dd>
            {accepted ? (
              <><dt>Agreed price</dt><dd><span className="big num">{money(d.offer_price)}</span><div className="state live">Accepted {day(d.offer_accepted_at!)}</div></dd></>
            ) : (
              <><dt>Offer</dt><dd>{d.offer_price == null ? <span className="soft">None yet</span> : <><span className="big num">{money(d.offer_price)}</span>{offerNote && <div className="soft small">{offerNote}</div>}</>}</dd></>
            )}
            {fee != null && (isAdmin || isBuyer) && <><dt>Fee</dt><dd className="num">{money(fee)} <span className="soft small">({Number(d.fee_pct)}% at close)</span></dd></>}
            <dt>Warranty</dt><dd>{d.warranty_status ?? <span className="soft">Not stated</span>}</dd>
            {d.notes && reveal && <><dt>Seller notes</dt><dd>{d.notes}</dd></>}
          </dl>
          {offerError && <p className="notice offer-error" role="alert">Enter the offer as a whole dollar amount, for example 1,500,000.</p>}
          {canAccept && (
            <form action={acceptOffer} className="accept">
              <input type="hidden" name="deal_id" value={d.id} />
              <input type="hidden" name="offer_price" value={d.offer_price!} />
              <button className="go">Accept {money(d.offer_price)}<Arrow /></button>
            </form>
          )}
          {party && negotiable && (
            <form action={makeOffer} className="inline offer">
              <input type="hidden" name="deal_id" value={d.id} />
              <input name="offer_price" inputMode="numeric" placeholder={canAccept ? 'Counter offer in USD' : 'Offer in USD'} aria-label={canAccept ? 'Counter offer in USD' : 'Offer in USD'} required />
              <button className={canAccept ? 'line' : undefined}>{d.offer_price == null ? 'Make offer' : mine ? 'Change my offer' : 'Counter'}</button>
            </form>
          )}
          {accepted && <p className="soft offer-next">Next step: Gridstock arranges an independent inspection before funds move into escrow.</p>}
        </section>
      </div>

      {isAdmin && (
        <section className="panel ops">
          <h3>Operations: move this deal to another stage</h3>
          <form action={setStage} className="inline">
            <input type="hidden" name="deal_id" value={d.id} />
            <select name="stage" defaultValue={d.stage} aria-label="Stage">{[...STAGES, 'lost'].map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            <button>Update</button>
          </form>
        </section>
      )}

      <h2>Messages</h2>
      {msgs.length === 0 ? (
        <p className="blank">{ndaDone ? 'No messages yet. Share submittals, test reports and photos here.' : 'Messages open once both sides accept the NDA.'}</p>
      ) : (
        <ul className="log">
          {msgs.map(m => (
            <li key={m.id} className={isEvent(m) ? 'event' : undefined}>
              <div className="by">{isEvent(m) ? 'Stage change' : who(m)}<time dateTime={new Date(m.created_at).toISOString()}>{stamp(m.created_at)}</time></div>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      )}
      {(ndaDone || isAdmin) && (
        <form action={postMessage} className="stack reply">
          <input type="hidden" name="deal_id" value={d.id} />
          <textarea name="body" placeholder="Message, or links to submittals and test reports" aria-label="Message" required />
          <div><button>Send</button></div>
        </form>
      )}
    </>
  );
}
