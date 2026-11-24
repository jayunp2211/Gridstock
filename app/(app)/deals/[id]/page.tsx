import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { STAGES, STAGE_LABEL, money, units } from '@/lib/labels';
import type { Gap } from '@/lib/match';
import { fitOf } from '@/lib/matching';
import { agreement, ndaAccepted, NDA_DRAFT_NOTE, NDA_SUMMARY } from '@/lib/nda';
import { dealUnits, filled, taken } from '@/lib/units';
import { DEMO_KEEP_HOURS } from '@/lib/files';
import { isSample, sweep, visitor, type FileRow, type Room } from '@/lib/deal-files';
import { acceptNda, acceptOffer, leaveDeal, makeOffer, postMessage, setStage } from '@/app/actions';
import { Spec, Fit, Checks, Arrow, cat, day } from '@/components/ui';
import { AgreementText } from '@/components/agreement';
import { Documents } from './documents';
import { Steps, hasSteps, type StepDeal } from './steps';

export const metadata = { title: 'Deal room' };

export const dynamic = 'force-dynamic';

type D = StepDeal & {
  buyer_nda_at: string | null; seller_nda_at: string | null; nda_version: string | null; fee_pct: string;
  offer_by: string | null; offer_accepted_at: string | null;
  /** Units in this deal. Empty on a deal opened before units were recorded. */
  quantity: number | null;
  score: number; gaps: Gap[]; request_id: string; buyer_id: string; seller_id: string;
  category: string; oem: string; model: string | null; voltage_v: number; secondary_v: number | null; amps: number | null; capacity: number | null;
  kaic: number | null; enclosure: string | null; configuration: string | null;
  condition: string; location_state: string; available_date: string; asking_price: number | null;
  warranty_status: string | null; notes: string | null; standard: string | null;
  buyer_name: string; buyer_company: string; seller_name: string; seller_company: string; need_by: string; site_state: string;
  /** Units listed and units needed in all, and how many of each no accepted deal has taken. */
  have_qty: number; need_qty: number; open_units: number; open_need: number;
  budget_max: number | null; req: Record<string, unknown>; lst: Record<string, unknown>;
};
type Msg = { id: string; body: string; created_at: string; name: string | null; company: string | null; author_id: string | null };
type Search = { offer?: string; nda?: string; step?: string; file?: string };

const stamp = (d: string) =>
  new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';

export default async function DealRoom({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const u = await requireUser();
  const { id } = await params;
  const { offer: offerError, nda: ndaError, step: stepError, file: fileOutcome } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await one<D>(
    `select d.*, to_char(d.inspection_on, 'YYYY-MM-DD') as inspection_day,
            m.score, m.gaps, m.request_id, r.buyer_id, l.seller_id, l.category, l.oem, l.model, l.voltage_v, l.secondary_v, l.amps, l.capacity, l.kaic, l.configuration,
            l.enclosure, l.condition, l.location_state, l.available_date, l.asking_price, l.warranty_status, l.notes, l.standard,
            b.name as buyer_name, b.company as buyer_company, s.name as seller_name, s.company as seller_company, r.need_by, r.site_state,
            l.quantity as have_qty, r.quantity as need_qty, l.quantity - ${taken('l')} as open_units, r.quantity - ${filled('r')} as open_need,
            r.budget_max, row_to_json(r) as req, row_to_json(l) as lst
     from deals d join matches m on m.id = d.match_id join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
     join users b on b.id = r.buyer_id join users s on s.id = l.seller_id where d.id = $1`, [id]);
  if (!d) notFound();
  const isBuyer = u.id === d.buyer_id, isSeller = u.id === d.seller_id, isAdmin = u.role === 'admin';
  if (!isBuyer && !isSeller && !isAdmin) notFound();
  const side = isBuyer ? 'buyer' : isSeller ? 'seller' : 'admin';
  const party = isBuyer || isSeller;
  const ndaDone = !!(d.buyer_nda_at && d.seller_nda_at);
  const reveal = ndaDone || isAdmin;
  const myNdaAt = isBuyer ? d.buyer_nda_at : isSeller ? d.seller_nda_at : null;
  const myNda = ndaAccepted(myNdaAt, d);
  // What the NDA panel says about one side. An acceptance from before the agreement had a text is asked for again.
  const early = (at: string | null) => !!at && !ndaAccepted(at, d);
  const ndaState = (who: string, at: string | null) =>
    ndaAccepted(at, d) ? <li className="state live">{who} accepted</li>
      : <li className="state">{who} {early(at) ? 'is asked to accept again' : 'has not accepted yet'}</li>;
  const earlyNote = early(myNdaAt) ? 'You accepted before the agreement had its full text. Read it, then accept it here.'
    : early(d.buyer_nda_at) ? 'The buyer accepted before the agreement had its full text, and is asked to accept the text itself.'
    : early(d.seller_nda_at) ? 'The seller accepted before the agreement had its full text, and is asked to accept the text itself.'
    : null;
  // Both sides accept the same text: the version in force when the first of them accepted.
  const nda = agreement(d.nda_version);

  const [msgs, listed, browser] = await Promise.all([
    q<Msg>(
      `select dm.id, dm.body, dm.created_at, dm.author_id, u.name, u.company from deal_messages dm left join users u on u.id = dm.author_id
       where dm.deal_id = $1 order by dm.created_at`, [id]),
    q<FileRow & { expired: boolean }>(
      `select f.*, (f.visitor is not null and f.created_at < now() - make_interval(hours => $2::int)) as expired
         from deal_files f where f.deal_id = $1 and f.complete order by f.created_at`, [id, DEMO_KEEP_HOURS]),
    visitor(),
  ]);
  // A demo file is gone a day after it was added, whether or not anyone uploads again.
  if (listed.some(f => f.expired)) await sweep();
  const files = listed.filter(f => !f.expired);
  const room: Room = { id: d.id, stage: d.stage, buyer_id: d.buyer_id, seller_id: d.seller_id, signed: ndaDone, role: side };

  const who = (m: Msg) => {
    if (!m.author_id) return 'Gridstock';
    if (m.author_id === u.id) return 'You';
    if (m.author_id === d.buyer_id) return reveal ? `${m.name}, ${m.company}` : 'Buyer';
    if (m.author_id === d.seller_id) return reveal ? `${m.name}, ${m.company}` : 'Seller';
    return 'Gridstock operations';
  };
  const isEvent = (m: Msg) => m.body.startsWith('Stage moved to');
  const stageIdx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const hidden = <span className="soft">Hidden until NDA</span>;

  // Units. Once an offer is accepted this deal holds its units, and the rest of the listing stays open to other buyers.
  // Every price on this page is a total for the units in the deal.
  const qty = dealUnits(d);
  const held = ['inspection', 'escrow', 'closed'].includes(d.stage);
  const own = held ? qty : 0;
  // What this deal can draw on: units no other accepted deal has taken, and need no other accepted deal covers.
  const canHave = d.open_units + own, canNeed = d.open_need + own;
  const most = Math.min(canHave, canNeed);
  const cap = Math.max(1, most);
  const each = (n: number) => (qty > 1 ? `${money(Math.round(n / qty))} each` : null);
  const asking = d.asking_price == null ? null : Math.round((d.asking_price * qty) / d.have_qty);
  const pct = Number(d.fee_pct);
  const fee = d.offer_price ? Math.round((d.offer_price * pct) / 100) : null;

  // The fit is worked out from the two records as they stand now, under the current rules, and counts only the units this deal can draw on.
  const fit = fitOf({ ...d.req, quantity: Math.max(1, canNeed) }, { ...d.lst, quantity: Math.max(1, canHave) })
    ?? { score: d.score, gaps: d.gaps.filter(g => !/price|budget/i.test(g.text)) };

  // Offers: either party can make one after the NDA; only the side that received it can accept.
  const accepted = !!d.offer_accepted_at;
  const open = ['nda', 'documents', 'offer'].includes(d.stage) && !accepted;
  const negotiable = ndaDone && open && d.stage !== 'nda';
  const mine = d.offer_by === u.id;
  const from = d.offer_by === d.buyer_id ? 'buyer' : d.offer_by === d.seller_id ? 'seller' : null;
  const fits = qty <= most;
  const standing = party && negotiable && d.offer_price != null && from != null && !mine;
  const canAccept = standing && fits;
  const offerNote = d.offer_price == null ? null
    : !negotiable ? (from ? `From the ${from}.` : null)
    : mine ? `Your offer. Waiting for the ${isBuyer ? 'seller' : 'buyer'} to accept or counter.`
    : from ? `From the ${from}.${canAccept ? ' Accept it or counter below.' : ''}` : null;
  const budget = d.budget_max == null ? null : Math.round((d.budget_max * qty) / d.need_qty);
  const overBudget = isBuyer && reveal && asking != null && budget != null ? asking - budget : null;

  const is = (n: number) => (n === 1 ? 'is' : 'are');
  const qtyNote = held
    ? [
        d.have_qty > qty ? `This deal takes ${qty} of the ${d.have_qty} listed. The rest ${is(d.have_qty - qty) === 'is' ? 'stays' : 'stay'} open to other buyers.` : null,
        d.need_qty > qty ? `It covers ${qty} of the ${d.need_qty} the buyer needs.` : null,
      ].filter(Boolean).join(' ')
    : [
        d.need_qty !== qty || d.open_need !== d.need_qty
          ? `The buyer needs ${d.need_qty}${d.open_need < d.need_qty ? `, and other deals already cover ${d.need_qty - Math.max(0, d.open_need)}` : ''}.` : null,
        d.have_qty !== qty || d.open_units !== d.have_qty
          ? `The seller listed ${d.have_qty}${d.open_units < d.have_qty ? `, and ${d.open_units > 0 ? `${d.open_units} ${is(d.open_units)}` : 'none are'} still open` : ''}.` : null,
      ].filter(Boolean).join(' ');
  // While the two sides negotiate, other deals on the same listing or request can take the units this one counts on.
  const short = !open || d.stage === 'lost' ? null
    : d.open_units <= 0 ? 'Every unit of this listing is reserved in another deal. An offer here can be accepted only if that deal falls through.'
    : d.open_need <= 0 ? 'Other deals already cover everything this request needs. An offer here can be accepted only if one of them falls through.'
    : !fits ? `Only ${units(most)} ${is(most)} open now, so an offer for ${units(qty)} cannot be accepted. Make a new offer for ${most === 1 ? 'one unit' : `${most} or fewer`}.`
    : null;
  const OFFER_ERRORS: Record<string, string> = {
    invalid: 'Enter the offer as a whole dollar amount, for example 1,500,000.',
    units: `Enter how many units the offer is for, from 1 to ${cap}.`,
    taken: 'That offer can no longer be accepted, because another deal took units it counted on.',
  };

  return (
    <>
      <Link href="/deals" className="back"><Arrow />Deals</Link>
      <div className="dealtop">
        <div>
          <h1>{d.oem} {d.model ?? ''}</h1>
          <Spec x={{ ...d, quantity: qty }} full />
          <p className="soft">{cat(d.category)}</p>
        </div>
        <Fit value={fit.score} />
      </div>

      <ol className="stages" aria-label="Deal stage">
        {STAGES.map((s, i) => (
          <li key={s} className={s === d.stage ? 'now' : i < stageIdx ? 'done' : ''} aria-current={s === d.stage ? 'step' : undefined}>{STAGE_LABEL[s]}</li>
        ))}
      </ol>
      {d.stage === 'lost' && <div className="notice" role="status">This deal has ended. The record below stays for both sides.</div>}

      {!ndaDone && d.stage !== 'lost' && (
        <section className="panel nda" id="nda">
          <div>
            <h2 className="panel-title">{nda.title}</h2>
            <p>Names, the asking price and the seller&rsquo;s notes are revealed once both sides accept. In short, each side agrees to this:</p>
            <ul className="points">{NDA_SUMMARY.map(s => <li key={s}>{s}</li>)}</ul>
            <details className="fold">
              <summary>Read the full agreement</summary>
              <AgreementText a={nda} />
            </details>
            <p className="soft small">Version {nda.version}. {NDA_DRAFT_NOTE}</p>
          </div>
          <div className="nda-side">
            <ul>
              {ndaState('Buyer', d.buyer_nda_at)}
              {ndaState('Seller', d.seller_nda_at)}
            </ul>
            {earlyNote && <p className="soft small">{earlyNote}</p>}
            {ndaError && <p className="notice" role="alert">Tick the box to say you have read the agreement, then accept it.</p>}
            {party && !myNda && (
              <form action={acceptNda} className="stack">
                <input type="hidden" name="deal_id" value={d.id} />
                <input type="hidden" name="version" value={nda.version} />
                <div className="choices long">
                  <label><input type="checkbox" name="agree" value="yes" required />I have read the agreement, and I can accept it for {u.company}.</label>
                </div>
                <div><button className="go">Accept NDA<Arrow /></button></div>
              </form>
            )}
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
            {d.configuration && <><dt>Configuration</dt><dd>{d.configuration}</dd></>}
            {ndaDone && (
              <>
                <dt>NDA</dt>
                <dd>
                  Accepted by both sides
                  <div className="soft small">
                    Buyer on {day(d.buyer_nda_at!)}, seller on {day(d.seller_nda_at!)}.{' '}
                    {d.nda_version
                      ? <Link href={`/nda?version=${nda.version}`} className="u">Read version {nda.version}</Link>
                      : <>Both accepted before the agreement had its full text. <Link href="/nda" className="u">Read the text new deals use</Link></>}
                  </div>
                </dd>
              </>
            )}
          </dl>
          <Checks gaps={fit.gaps} />
        </section>
        <section>
          <h2>Commercials</h2>
          <dl className="facts">
            <dt>Quantity</dt>
            <dd>
              {units(qty)}
              {qtyNote && <div className="soft small">{qtyNote}</div>}
            </dd>
            <dt>Asking</dt>
            <dd>
              {!(reveal || isSeller) ? hidden : asking == null ? <span className="soft">Not set</span> : (
                <>
                  <span className="big num">{money(asking)}</span>
                  <div className="soft small">
                    For {units(qty)}{each(asking) && `, ${each(asking)}`}.
                    {overBudget != null && (overBudget > 0 ? ` That is ${money(overBudget)} over your budget ceiling for ${units(qty)}.` : ' That is within your budget ceiling.')}
                  </div>
                </>
              )}
            </dd>
            {accepted ? (
              <><dt>Agreed price</dt><dd><span className="big num">{money(d.offer_price)}</span><div className="soft small">For {units(qty)}{each(d.offer_price!) && `, ${each(d.offer_price!)}`}.</div><div className="state live">Accepted {day(d.offer_accepted_at!)}</div></dd></>
            ) : (
              <><dt>Offer</dt><dd>{d.offer_price == null ? <span className="soft">None yet</span> : <><span className="big num">{money(d.offer_price)}</span><div className="soft small">For {units(qty)}{each(d.offer_price) && `, ${each(d.offer_price)}`}. {offerNote}</div></>}</dd></>
            )}
            <dt>Gridstock fee</dt>
            <dd>
              {isSeller ? <>None for the seller<div className="soft small">The buyer pays {pct}% of the price when the deal closes.</div></>
                : fee == null ? <>{pct}% of the price<div className="soft small">Paid by the buyer when the deal closes. Nothing is owed if it does not.</div></>
                : <><span className="num">{money(fee)}</span><div className="soft small">{pct}% of the price, paid by the buyer when the deal closes. {isBuyer ? 'You pay' : 'The buyer pays'} {money(d.offer_price! + fee)} in all.</div></>}
            </dd>
            <dt>Warranty</dt><dd>{d.warranty_status ?? <span className="soft">Not stated</span>}</dd>
            {d.notes && reveal && <><dt>Seller notes</dt><dd>{d.notes}</dd></>}
          </dl>
          {offerError && <p className="notice offer-error" role="alert">{Object.hasOwn(OFFER_ERRORS, offerError) ? OFFER_ERRORS[offerError] : OFFER_ERRORS.invalid}</p>}
          {short && ndaDone && <p className="caution offer-short">{short}</p>}
          {canAccept && (
            <form action={acceptOffer} className="accept">
              <input type="hidden" name="deal_id" value={d.id} />
              <input type="hidden" name="offer_price" value={d.offer_price!} />
              <button className="go">Accept {money(d.offer_price)} for {units(qty)}<Arrow /></button>
            </form>
          )}
          {party && negotiable && (
            <form action={makeOffer} className={cap > 1 ? 'offer-form' : 'offer-form single'}>
              <input type="hidden" name="deal_id" value={d.id} />
              {cap > 1
                ? <label>Units<input name="quantity" type="number" inputMode="numeric" min={1} max={cap} step={1} defaultValue={Math.min(qty, cap)} required /></label>
                : <input type="hidden" name="quantity" value={1} />}
              <label>{standing ? 'Counter offer' : 'Offer'}, total in USD<input name="offer_price" inputMode="numeric" placeholder="Whole dollars" required /></label>
              <button className={canAccept ? 'line' : undefined}>{d.offer_price == null ? 'Make offer' : mine ? 'Change my offer' : 'Counter'}</button>
            </form>
          )}
        </section>
      </div>

      {hasSteps(d) && <Steps d={d} side={side} fee={fee} error={stepError} />}

      <Documents room={room} viewer={{ id: u.id, sample: isSample(u) }} files={files} browser={browser} outcome={fileOutcome} />

      {isAdmin && (
        <section className="panel ops">
          <h2 className="panel-title">Operations: move this deal to another stage</h2>
          <p className="soft">The two sides move a deal forward themselves. Use this to put right a step that was recorded by mistake, or to end a deal.</p>
          <form action={setStage} className="inline">
            <input type="hidden" name="deal_id" value={d.id} />
            <select name="stage" defaultValue={d.stage} aria-label="Stage">{[...STAGES, 'lost'].map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            <button>Update</button>
          </form>
        </section>
      )}

      <h2 id="messages">Messages</h2>
      {msgs.length === 0 ? (
        <p className="blank">{ndaDone ? 'No messages yet.' : 'Messages open once both sides accept the NDA.'}</p>
      ) : (
        <ul className="log">
          {msgs.map(m => (
            <li key={m.id} className={isEvent(m) || !m.author_id ? 'event' : undefined}>
              <div className="by">{isEvent(m) ? 'Stage change' : who(m)}<time dateTime={new Date(m.created_at).toISOString()}>{stamp(m.created_at)}</time></div>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      )}
      {!ndaDone && !isAdmin && d.stage !== 'lost' && msgs.length > 0 && <p className="soft small log-note">You can write to each other here once both sides accept the NDA.</p>}
      {(ndaDone || isAdmin) && d.stage !== 'lost' && (
        <form action={postMessage} className="stack reply">
          <input type="hidden" name="deal_id" value={d.id} />
          <textarea name="body" maxLength={4000} placeholder="Message" aria-label="Message" required />
          <div><button>Send</button></div>
        </form>
      )}

      {party && open && (
        <details className="leave">
          <summary>Leave this deal</summary>
          <form action={leaveDeal} className="inline">
            <input type="hidden" name="deal_id" value={d.id} />
            <input name="reason" maxLength={300} placeholder="Reason, shared with the other side (optional)" aria-label="Reason for leaving, shared with the other side" />
            <button className="line">Leave deal</button>
          </form>
          <p className="soft small">This ends the deal for both sides. The listing and the request stay open for other matches.</p>
        </details>
      )}
    </>
  );
}
