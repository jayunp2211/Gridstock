'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one, pool } from '@/lib/db';
import { requireUser, SESSION, type User } from '@/lib/auth';
import { syncListing, syncRequest } from '@/lib/matching';
import { seedDemo } from '@/lib/demo';
import { capacityUnit, CATEGORIES, CONDITIONS, STAGES, STATES, units } from '@/lib/labels';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(/[$,\s]/g, '');
  return v === '' ? null : Number(v);
};
const list = (f: FormData, k: string) => str(f, k).split(',').map(s => s.trim()).filter(Boolean);
const UUID = /^[0-9a-f-]{36}$/;

// ---------- form checks ----------
// The browser enforces the same limits first. These are the backstop, and they name the field
// by a code so the page can explain it without echoing anything from the URL.
class Invalid extends Error {
  constructor(public field: string) { super(field); }
}
const need = (ok: boolean, field: string) => { if (!ok) throw new Invalid(field); };
const whole = (v: number | null, min: number, max: number) => v != null && Number.isInteger(v) && v >= min && v <= max;
const blankOr = (v: number | null, min: number, max: number) => v == null || whole(v, min, max);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const short = (s: string, max: number) => s.length <= max;
const today = () => new Date().toISOString().slice(0, 10);
const has = (pairs: [string, string][], v: string) => pairs.some(p => p[0] === v);

async function notify(userId: string, body: string, link: string) {
  await q(`insert into notifications (user_id, body, link) values ($1,$2,$3)`, [userId, body, link]);
}
/** A line in the deal log from Gridstock itself, not from either party. */
async function logLine(dealId: string, body: string) {
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1, null, $2)`, [dealId, body]);
}

// ---------- accounts ----------
export async function signIn(f: FormData) {
  const id = str(f, 'user_id');
  // Only sample accounts can be entered from the picker.
  const u = UUID.test(id) ? await one<{ role: string }>(`select role from users where id = $1 and email like '%.test'`, [id]) : null;
  if (!u) redirect('/login');
  (await cookies()).set('uid', id, SESSION);
  redirect(u.role === 'seller' ? '/listings' : u.role === 'buyer' ? '/requests' : '/admin');
}

/**
 * A real company asking to join. It is recorded as an unverified account and nothing more:
 * no session is created, because until email sign-in exists an address alone must not open an account.
 */
export async function requestAccess(f: FormData) {
  const role = str(f, 'role') === 'buyer' ? 'buyer' : 'seller';
  const name = str(f, 'name'), email = str(f, 'email').toLowerCase(), company = str(f, 'company'), note = str(f, 'note');
  if (str(f, 'website')) redirect('/login?requested=1'); // a field people never see; only scripts fill it
  const ok = name.length >= 2 && short(name, 80) && company.length >= 2 && short(company, 120) && short(note, 1000)
    && short(email, 200) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.test');
  if (!ok) redirect(`/login?role=${role}&error=access`);
  // A second request from the same address changes nothing: anyone can type someone else's address here.
  await q(`insert into users (email, name, company, role, note) values ($1,$2,$3,$4,$5) on conflict (email) do nothing`,
    [email, name, company, role, note || null]);
  redirect('/login?requested=1');
}

export async function signOut() {
  (await cookies()).delete('uid');
  redirect('/');
}

// ---------- listings and requests ----------
export async function createListing(f: FormData) {
  const u = await requireUser('seller');
  const v = {
    category: str(f, 'category'), oem: str(f, 'oem'), model: str(f, 'model'), voltage: num(f, 'voltage_v'), secondary: num(f, 'secondary_v'),
    amps: num(f, 'amps'), capacity: num(f, 'capacity'), kaic: num(f, 'kaic'), enclosure: str(f, 'enclosure'), standard: str(f, 'standard'),
    configuration: str(f, 'configuration'), condition: str(f, 'condition'),
    quantity: num(f, 'quantity') ?? 1, state: str(f, 'location_state').toUpperCase(), available: str(f, 'available_date'),
    price: num(f, 'asking_price'), warranty: str(f, 'warranty_status'), notes: str(f, 'notes'),
  };
  // Which ratings apply follows from the category. The ones that do not apply are not stored, whatever was sent.
  const sized = capacityUnit(v.category) != null, transformer = v.category === 'transformer';
  try {
    need(has(CATEGORIES, v.category), 'category');
    need(v.oem.length > 0 && short(v.oem, 40), 'oem');
    need(whole(v.voltage, 100, 800_000), 'voltage');
    if (transformer) need(whole(v.secondary, 100, 800_000), 'secondary');
    if (sized) need(whole(v.capacity, 1, 500_000), 'capacity');
    else {
      need(whole(v.amps, 1, 20_000), 'amps');
      need(blankOr(v.kaic, 1, 250), 'kaic');
    }
    need(has(CONDITIONS, v.condition), 'condition');
    need(whole(v.quantity, 1, 500), 'quantity');
    need(has(STATES, v.state), 'state');
    need(isDate(v.available), 'date');
    need(blankOr(v.price, 1, 2_000_000_000), 'price');
    need(short(v.model, 60) && short(v.enclosure, 30) && short(v.standard, 30) && short(v.warranty, 120) && short(v.notes, 2000)
      && short(v.configuration, 600), 'text');
  } catch (e) {
    if (e instanceof Invalid) redirect(`/listings/new?error=${e.field}`);
    throw e;
  }
  const row = await one<{ id: string }>(
    `insert into listings (seller_id, category, oem, model, voltage_v, secondary_v, amps, capacity, kaic, enclosure, standard, configuration,
       condition, quantity, location_state, available_date, asking_price, warranty_status, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
    [u.id, v.category, v.oem, v.model || null, v.voltage, transformer ? v.secondary : null, sized ? null : v.amps, sized ? v.capacity : null,
     sized ? null : v.kaic, v.enclosure || null, v.standard || null, v.configuration || null, v.condition,
     v.quantity, v.state, v.available, v.price, v.warranty || null, v.notes || null],
  );
  await syncListing(row!.id);
  redirect(`/listings/${row!.id}?created=1`);
}

export async function createRequest(f: FormData) {
  const u = await requireUser('buyer');
  const v = {
    category: str(f, 'category'), voltage: num(f, 'voltage_v'), secondary: num(f, 'secondary_v'), amps: num(f, 'amps_min'),
    capacity: num(f, 'capacity_min'), kaic: num(f, 'kaic_min'),
    enclosure: str(f, 'enclosure'), oems: list(f, 'acceptable_oems'), conditions: f.getAll('conditions_ok').map(String),
    quantity: num(f, 'quantity') ?? 1, state: str(f, 'site_state').toUpperCase(), needBy: str(f, 'need_by'),
    budget: num(f, 'budget_max'), notes: str(f, 'notes'),
  };
  const sized = capacityUnit(v.category) != null, transformer = v.category === 'transformer';
  try {
    need(has(CATEGORIES, v.category), 'category');
    need(whole(v.voltage, 100, 800_000), 'voltage');
    if (transformer) need(whole(v.secondary, 100, 800_000), 'secondary');
    if (sized) need(whole(v.capacity, 1, 500_000), 'capacity');
    else {
      need(whole(v.amps, 1, 20_000), 'amps');
      need(blankOr(v.kaic, 1, 250), 'kaic');
    }
    need(v.conditions.length > 0 && v.conditions.every(c => has(CONDITIONS, c)), 'conditions_ok');
    need(whole(v.quantity, 1, 500), 'quantity');
    need(has(STATES, v.state), 'state');
    need(isDate(v.needBy), 'date');
    need(v.needBy >= today(), 'need_by');
    need(blankOr(v.budget, 1, 2_000_000_000), 'price');
    need(short(v.enclosure, 30) && short(v.notes, 2000) && v.oems.length <= 12 && v.oems.every(o => short(o, 40)), 'text');
  } catch (e) {
    if (e instanceof Invalid) redirect(`/requests/new?error=${e.field}`);
    throw e;
  }
  const row = await one<{ id: string }>(
    `insert into requests (buyer_id, category, voltage_v, secondary_v, amps_min, capacity_min, kaic_min, enclosure, acceptable_oems, conditions_ok,
       quantity, site_state, need_by, budget_max, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
    [u.id, v.category, v.voltage, transformer ? v.secondary : null, sized ? null : v.amps, sized ? v.capacity : null, sized ? null : v.kaic,
     v.enclosure || null, v.oems, v.conditions, v.quantity, v.state, v.needBy, v.budget, v.notes || null],
  );
  await syncRequest(row!.id);
  redirect(`/requests/${row!.id}`);
}

/** Deals still being negotiated end when the gear or the need behind them is taken off the market. */
async function endOpenDeals(by: 'listing_id' | 'request_id', id: string, note: string) {
  const ended = await q<{ id: string; buyer_id: string; seller_id: string }>(
    `update deals d set stage = 'lost', updated_at = now() from matches m, requests r, listings l
      where m.id = d.match_id and r.id = m.request_id and l.id = m.listing_id and m.${by} = $1
        and d.stage in ('nda','documents','offer') and d.offer_accepted_at is null
      returning d.id, r.buyer_id, l.seller_id`, [id]);
  for (const d of ended) {
    await logLine(d.id, note);
    await notify(by === 'listing_id' ? d.buyer_id : d.seller_id, note, `/deals/${d.id}`);
  }
}

export async function setListingStatus(f: FormData) {
  const u = await requireUser('seller');
  const id = str(f, 'listing_id'), to = str(f, 'to');
  const l = UUID.test(id) ? await one<{ status: string }>(`select status from listings where id = $1 and seller_id = $2`, [id, u.id]) : null;
  if (!l) return;
  if (to === 'withdrawn' && l.status === 'active') {
    await q(`update listings set status = 'withdrawn' where id = $1`, [id]);
    await endOpenDeals('listing_id', id, 'The seller withdrew this listing, so the deal has ended.');
  } else if (to === 'active' && l.status === 'withdrawn') {
    await q(`update listings set status = 'active' where id = $1`, [id]);
    await syncListing(id);
  }
  revalidatePath(`/listings/${id}`);
}

export async function setRequestStatus(f: FormData) {
  const u = await requireUser('buyer');
  const id = str(f, 'request_id'), to = str(f, 'to');
  const r = UUID.test(id) ? await one<{ status: string }>(`select status from requests where id = $1 and buyer_id = $2`, [id, u.id]) : null;
  if (!r) return;
  if (to === 'closed' && r.status === 'open') {
    await q(`update requests set status = 'closed' where id = $1`, [id]);
    await endOpenDeals('request_id', id, 'The buyer closed this request, so the deal has ended.');
  } else if (to === 'open' && r.status === 'closed') {
    await q(`update requests set status = 'open' where id = $1`, [id]);
    await syncRequest(id);
  }
  revalidatePath(`/requests/${id}`);
}

// ---------- deals ----------
type DealRow = {
  id: string; stage: string; buyer_id: string; seller_id: string; listing_id: string; request_id: string;
  buyer_nda_at: string | null; seller_nda_at: string | null; offer_price: number | null; offer_by: string | null;
  offer_accepted_at: string | null; need_qty: number; have_qty: number;
};

async function dealFor(dealId: string, userId: string) {
  if (!UUID.test(dealId)) return null;
  return one<DealRow>(
    `select d.id, d.stage, d.buyer_nda_at, d.seller_nda_at, d.offer_price, d.offer_by, d.offer_accepted_at,
            r.buyer_id, l.seller_id, m.listing_id, m.request_id, r.quantity as need_qty, l.quantity as have_qty from deals d
       join matches m on m.id = d.match_id join requests r on r.id = m.request_id join listings l on l.id = m.listing_id
     where d.id = $1 and ($2 in (r.buyer_id, l.seller_id) or exists (select 1 from users where id = $2 and role = 'admin'))`,
    [dealId, userId],
  );
}

const usd = (n: number) => '$' + n.toLocaleString('en-US');
const side = (d: DealRow, u: User) => (u.id === d.buyer_id ? 'buyer' : 'seller');
const other = (d: DealRow, u: User) => (u.id === d.buyer_id ? d.seller_id : d.buyer_id);
/** A deal covers as many units as the buyer needs, up to what the seller has. Prices are totals for that quantity. */
const lot = (d: DealRow) => units(Math.min(d.need_qty, d.have_qty));
/** Offers can be made and answered only by the two parties, after the NDA, and until one is accepted. */
const negotiable = (d: DealRow) =>
  !!d.buyer_nda_at && !!d.seller_nda_at && !d.offer_accepted_at && ['documents', 'offer'].includes(d.stage);

/** Either side can open a deal room on a match: a buyer asks for an intro, a seller proposes one. */
async function startDeal(f: FormData, by: 'buyer' | 'seller') {
  const u = await requireUser(by);
  const matchId = str(f, 'match_id');
  const m = UUID.test(matchId) ? await one<{ seller_id: string; buyer_id: string; listing_id: string; request_id: string; listing_status: string; request_status: string; deal_id: string | null }>(
    `select l.seller_id, r.buyer_id, m.listing_id, m.request_id, l.status as listing_status, r.status as request_status, d.id as deal_id
       from matches m join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
       left join deals d on d.match_id = m.id where m.id = $1`, [matchId]) : null;
  if (!m || (by === 'buyer' ? m.buyer_id : m.seller_id) !== u.id) throw new Error('This match belongs to another account.');
  if (m.deal_id) redirect(`/deals/${m.deal_id}`);
  // The gear or the need may have been taken since the page was loaded. Send them back to see why.
  if (m.listing_status !== 'active' || m.request_status !== 'open')
    redirect(by === 'buyer' ? `/requests/${m.request_id}` : `/listings/${m.listing_id}`);
  const d = await one<{ id: string }>(
    `insert into deals (match_id) values ($1) on conflict (match_id) do update set updated_at = now() returning id`, [matchId]);
  await logLine(d!.id, by === 'buyer' ? 'The buyer asked for an introduction.' : 'The seller proposed an introduction.');
  if (by === 'buyer') await notify(m.seller_id, 'A buyer wants an intro on your listing', `/deals/${d!.id}`);
  else await notify(m.buyer_id, 'A seller is offering gear that fits your request', `/deals/${d!.id}`);
  redirect(`/deals/${d!.id}`);
}
export async function requestIntro(f: FormData) { await startDeal(f, 'buyer'); }
export async function proposeIntro(f: FormData) { await startDeal(f, 'seller'); }

export async function acceptNda(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d) throw new Error('This deal belongs to another account.');
  if (![d.buyer_id, d.seller_id].includes(u.id) || d.stage !== 'nda') return;
  if (u.id === d.buyer_id ? d.buyer_nda_at : d.seller_nda_at) return;
  await q(`update deals set ${u.id === d.buyer_id ? 'buyer_nda_at' : 'seller_nda_at'} = now(), updated_at = now() where id = $1`, [d.id]);
  const open = await one<{ id: string }>(
    `update deals set stage = 'documents' where id = $1 and stage = 'nda' and buyer_nda_at is not null and seller_nda_at is not null returning id`, [d.id]);
  if (open) {
    await logLine(d.id, 'Both sides accepted the NDA. Names, asking price and seller notes are now visible to each other.');
    await notify(other(d, u), 'Both sides have accepted the NDA. The deal room is open.', `/deals/${d.id}`);
  } else {
    await notify(other(d, u), `The ${side(d, u)} accepted the NDA and is waiting for you.`, `/deals/${d.id}`);
  }
  revalidatePath(`/deals/${d.id}`);
}

export async function postMessage(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const body = str(f, 'body').slice(0, 4000);
  if (!d || !body) return;
  const party = [d.buyer_id, d.seller_id].includes(u.id);
  // The two sides talk only once both have signed and while the deal is alive. Operations can write at any stage.
  if (party && (!(d.buyer_nda_at && d.seller_nda_at) || d.stage === 'lost')) return;
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, body]);
  for (const to of party ? [other(d, u)] : [d.buyer_id, d.seller_id]) await notify(to, 'New message in a deal room', `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

export async function makeOffer(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const price = num(f, 'offer_price');
  if (!d || ![d.buyer_id, d.seller_id].includes(u.id) || !negotiable(d)) return;
  if (!whole(price, 1, 2_000_000_000)) redirect(`/deals/${d.id}?offer=invalid`);
  await q(`update deals set offer_price = $2, offer_by = $3, stage = 'offer', updated_at = now() where id = $1`, [d.id, price, u.id]);
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, `Offer: ${usd(price!)} for ${lot(d)}`]);
  await notify(other(d, u), `The ${side(d, u)} offered ${usd(price!)} for ${lot(d)}. Accept it or counter.`, `/deals/${d.id}`);
  redirect(`/deals/${d.id}`);
}

export async function acceptOffer(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || ![d.buyer_id, d.seller_id].includes(u.id) || !negotiable(d)) return;
  // Only the side that received the offer can accept it, and only at the price they were shown.
  if (d.offer_price == null || !d.offer_by || d.offer_by === u.id) return;
  if (num(f, 'offer_price') !== d.offer_price) return;
  const done = await one<{ id: string }>(
    `update deals set offer_accepted_at = now(), stage = 'inspection', updated_at = now()
     where id = $1 and offer_price = $2 and offer_by = $3 and offer_accepted_at is null returning id`,
    [d.id, d.offer_price, d.offer_by]);
  if (!done) return;
  await q(`update listings set status = 'under_offer' where id = $1 and status = 'active'`, [d.listing_id]);
  await q(`update requests set status = 'in_deal' where id = $1 and status = 'open'`, [d.request_id]);
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`,
    [d.id, u.id, `Accepted the offer of ${usd(d.offer_price)} for ${lot(d)}. Next step: independent inspection.`]);
  await notify(d.offer_by, `Your offer of ${usd(d.offer_price)} was accepted. Next step: independent inspection.`, `/deals/${d.id}`);
  await q(`insert into notifications (user_id, body, link) select id, $1, $2 from users where role = 'admin'`,
    [`An offer of ${usd(d.offer_price)} was accepted. Arrange the inspection.`, `/deals/${d.id}`]);
  revalidatePath(`/deals/${d.id}`);
}

/** Either side can walk away while the deal is still being negotiated. After an offer is accepted, only operations can end it. */
export async function leaveDeal(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || ![d.buyer_id, d.seller_id].includes(u.id)) return;
  if (d.offer_accepted_at || !['nda', 'documents', 'offer'].includes(d.stage)) return;
  const reason = str(f, 'reason').slice(0, 300);
  await q(`update deals set stage = 'lost', updated_at = now() where id = $1`, [d.id]);
  await logLine(d.id, `The ${side(d, u)} left this deal.${reason ? ` Reason given: ${reason}` : ''}`);
  await notify(other(d, u), `The ${side(d, u)} left a deal.`, `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

// ---------- operations ----------
export async function setStage(f: FormData) {
  const u = await requireUser('admin');
  const stage = str(f, 'stage');
  if (![...STAGES, 'lost'].includes(stage as (typeof STAGES)[number])) return;
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d) return;
  // Moving a deal back to an earlier stage reopens the negotiation.
  await q(`update deals set stage = $2, updated_at = now(),
             offer_accepted_at = case when $2 in ('nda','documents','offer') then null else offer_accepted_at end
           where id = $1`, [d.id, stage]);
  if (stage === 'inspection' || stage === 'escrow') {
    await q(`update listings set status = 'under_offer' where id = $1`, [d.listing_id]);
    await q(`update requests set status = 'in_deal' where id = $1`, [d.request_id]);
  }
  if (stage === 'closed') {
    await q(`update listings set status = 'sold' where id = $1`, [d.listing_id]);
    await q(`update requests set status = 'closed' where id = $1`, [d.request_id]);
  }
  if (stage === 'lost') {
    await q(`update listings set status = 'active' where id = $1 and status = 'under_offer'`, [d.listing_id]);
    await q(`update requests set status = 'open' where id = $1 and status = 'in_deal'`, [d.request_id]);
  }
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, `Stage moved to ${stage}`]);
  revalidatePath(`/deals/${d.id}`);
}

export async function verifyUser(f: FormData) {
  await requireUser('admin');
  // The demo's operations account is open to anyone, so it can only act on sample accounts.
  await q(`update users set verified = true where id = $1 and email like '%.test'`, [str(f, 'user_id')]);
  revalidatePath('/admin');
}

/** Put the sample companies, gear and requests back to their starting state. Real accounts are untouched. */
export async function resetDemo() {
  await requireUser('admin');
  const c = await pool.connect();
  try {
    await c.query('begin');
    await seedDemo((text, params) => c.query(text, params).then(r => r.rows));
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
  redirect('/admin?reset=1');
}
