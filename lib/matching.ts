import { q } from './db';
import { matchListing, MIN_SCORE, type Listing, type Request } from './match';

type Row = Record<string, unknown> & { id: string };
const asDate = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

function toReq(r: Row): Request {
  return { ...(r as unknown as Request), need_by: asDate(r.need_by) };
}
function toLst(l: Row): Listing {
  return { ...(l as unknown as Listing), available_date: asDate(l.available_date) };
}

async function save(reqRow: Row, lstRow: Row) {
  const m = matchListing(toReq(reqRow), toLst(lstRow));
  if (!m.ok || m.score < MIN_SCORE) return false;
  const inserted = await q(
    `insert into matches (request_id, listing_id, score, gaps) values ($1,$2,$3,$4)
     on conflict (request_id, listing_id) do update set score = excluded.score, gaps = excluded.gaps
     returning (xmax = 0) as is_new`,
    [reqRow.id, lstRow.id, m.score, JSON.stringify(m.gaps)],
  );
  if (inserted[0]?.is_new) {
    await q(`insert into notifications (user_id, body, link) values ($1,$2,$3)`, [
      reqRow.buyer_id,
      `New match (${m.score}/100): ${lstRow.oem} ${lstRow.category}, ${lstRow.voltage_v} V ${lstRow.amps} A`,
      `/requests/${reqRow.id}`,
    ]);
  }
  return true;
}

export async function matchForListing(listingId: string) {
  const [lst] = await q<Row>(`select * from listings where id = $1 and status = 'active'`, [listingId]);
  if (!lst) return 0;
  const reqs = await q<Row>(`select * from requests where status = 'open' and category = $1`, [lst.category]);
  let n = 0;
  for (const r of reqs) if (await save(r, lst)) n++;
  return n;
}

export async function matchForRequest(requestId: string) {
  const [req] = await q<Row>(`select * from requests where id = $1`, [requestId]);
  if (!req) return 0;
  const lsts = await q<Row>(`select * from listings where status = 'active' and category = $1`, [req.category]);
  let n = 0;
  for (const l of lsts) if (await save(req, l)) n++;
  return n;
}
