'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { matchForListing, matchForRequest } from '@/lib/matching';
import { STAGES } from '@/lib/labels';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(/[$,]/g, '');
  return v === '' ? null : Number(v);
};
const list = (f: FormData, k: string) => str(f, k).split(',').map(s => s.trim()).filter(Boolean);

export async function signIn(f: FormData) {
  const id = str(f, 'user_id');
  const u = await one<{ role: string }>('select role from users where id = $1', [id]);
  if (!u) redirect('/login');
  (await cookies()).set('uid', id, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect(u.role === 'seller' ? '/listings' : u.role === 'buyer' ? '/requests' : '/admin');
}

export async function signUp(f: FormData) {
  const role = str(f, 'role');
  if (!['seller', 'buyer'].includes(role)) throw new Error('bad role');
  const u = await one<{ id: string }>(
    `insert into users (email, name, company, role) values ($1,$2,$3,$4)
     on conflict (email) do update set name = excluded.name returning id`,
    [str(f, 'email').toLowerCase(), str(f, 'name'), str(f, 'company'), role],
  );
  (await cookies()).set('uid', u!.id, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect(role === 'seller' ? '/listings' : '/requests');
}

export async function signOut() {
  (await cookies()).delete('uid');
  redirect('/');
}

export async function createListing(f: FormData) {
  const u = await requireUser('seller');
  const row = await one<{ id: string }>(
    `insert into listings (seller_id, category, oem, model, voltage_v, amps, kaic, enclosure, standard, condition,
       quantity, location_state, available_date, asking_price, warranty_status, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
    [u.id, str(f, 'category'), str(f, 'oem'), str(f, 'model') || null, num(f, 'voltage_v'), num(f, 'amps'), num(f, 'kaic'),
     str(f, 'enclosure') || null, str(f, 'standard') || null, str(f, 'condition'), num(f, 'quantity') ?? 1,
     str(f, 'location_state').toUpperCase(), str(f, 'available_date'), num(f, 'asking_price'),
     str(f, 'warranty_status') || null, str(f, 'notes') || null],
  );
  await matchForListing(row!.id);
  revalidatePath('/listings');
  redirect('/listings?created=1');
}

export async function createRequest(f: FormData) {
  const u = await requireUser('buyer');
  const conditions = f.getAll('conditions_ok').map(String);
  const row = await one<{ id: string }>(
    `insert into requests (buyer_id, category, voltage_v, amps_min, kaic_min, enclosure, acceptable_oems, conditions_ok,
       quantity, site_state, need_by, budget_max, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [u.id, str(f, 'category'), num(f, 'voltage_v'), num(f, 'amps_min'), num(f, 'kaic_min'), str(f, 'enclosure') || null,
     list(f, 'acceptable_oems'), conditions.length ? conditions : ['new_crated', 'delivered_not_energized'],
     num(f, 'quantity') ?? 1, str(f, 'site_state').toUpperCase(), str(f, 'need_by'), num(f, 'budget_max'),
     str(f, 'notes') || null],
  );
  await matchForRequest(row!.id);
  redirect(`/requests/${row!.id}`);
}

type DealRow = { id: string; stage: string; buyer_id: string; seller_id: string; listing_id: string; request_id: string };

async function dealFor(dealId: string, userId: string) {
  return one<DealRow>(
    `select d.id, d.stage, r.buyer_id, l.seller_id, m.listing_id, m.request_id from deals d
       join matches m on m.id = d.match_id join requests r on r.id = m.request_id join listings l on l.id = m.listing_id
     where d.id = $1 and ($2 in (r.buyer_id, l.seller_id) or exists (select 1 from users where id = $2 and role = 'admin'))`,
    [dealId, userId],
  );
}

export async function requestIntro(f: FormData) {
  const u = await requireUser('buyer');
  const matchId = str(f, 'match_id');
  const m = await one<{ id: string; seller_id: string; buyer_id: string }>(
    `select m.id, l.seller_id, r.buyer_id from matches m join listings l on l.id = m.listing_id
       join requests r on r.id = m.request_id where m.id = $1`, [matchId]);
  if (!m || (m.buyer_id !== u.id && u.role !== 'admin')) throw new Error('not your match');
  const d = await one<{ id: string }>(
    `insert into deals (match_id) values ($1) on conflict (match_id) do update set updated_at = now() returning id`, [matchId]);
  await q(`insert into notifications (user_id, body, link) values ($1,$2,$3)`,
    [m.seller_id, 'A buyer wants an intro on your listing', `/deals/${d!.id}`]);
  redirect(`/deals/${d!.id}`);
}

export async function acceptNda(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d) throw new Error('not found');
  if (u.id === d.buyer_id) await q(`update deals set buyer_nda_at = coalesce(buyer_nda_at, now()), updated_at = now() where id = $1`, [d.id]);
  if (u.id === d.seller_id) await q(`update deals set seller_nda_at = coalesce(seller_nda_at, now()), updated_at = now() where id = $1`, [d.id]);
  await q(`update deals set stage = 'documents' where id = $1 and stage = 'nda' and buyer_nda_at is not null and seller_nda_at is not null`, [d.id]);
  revalidatePath(`/deals/${d.id}`);
}

export async function postMessage(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const body = str(f, 'body');
  if (!d || !body) return;
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, body]);
  const other = u.id === d.buyer_id ? d.seller_id : d.buyer_id;
  await q(`insert into notifications (user_id, body, link) values ($1,$2,$3)`, [other, 'New message in a deal room', `/deals/${d.id}`]);
  revalidatePath(`/deals/${d.id}`);
}

export async function makeOffer(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const price = num(f, 'offer_price');
  if (!d || price == null || Number.isNaN(price)) return;
  await q(`update deals set offer_price = $2, stage = case when stage in ('nda','documents') then 'offer' else stage end, updated_at = now() where id = $1`, [d.id, price]);
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, `Offer: $${price.toLocaleString('en-US')}`]);
  revalidatePath(`/deals/${d.id}`);
}

export async function setStage(f: FormData) {
  const u = await requireUser('admin');
  const stage = str(f, 'stage');
  if (![...STAGES, 'lost'].includes(stage as (typeof STAGES)[number])) return;
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d) return;
  await q(`update deals set stage = $2, updated_at = now() where id = $1`, [d.id, stage]);
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
  await q(`update users set verified = true where id = $1`, [str(f, 'user_id')]);
  revalidatePath('/admin');
}
