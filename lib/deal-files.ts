// Server side of the documents in a deal room: who may add, see and open them, and where the bytes go.
//
// A file is stored in the database in parts of a few megabytes, because the host limits how much one
// request can carry. Only the two sides of the deal and operations can reach it, and only once both
// sides have accepted the NDA.
//
// The demo's sample accounts are open to every visitor, so a file added in the demo is tied to the
// browser that added it. No other visitor can open it or see its name, whichever account they pick.
import { cookies } from 'next/headers';
import { one, pool, q } from './db';
import { SESSION, type User } from './auth';
import {
  DEMO_KEEP_HOURS, DEMO_STORE_BYTES, FILE_KINDS, MAX_FILE_BYTES, MAX_FILES_PER_DEAL,
  cleanName, fileSize, fileType, mayAdd, mayOpen, partsFor, partSize,
} from './files';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isId = (s: string) => UUID.test(s);

export type Room = {
  id: string; stage: string; buyer_id: string; seller_id: string;
  /** Both sides have accepted the NDA. */
  signed: boolean;
  role: 'buyer' | 'seller' | 'admin';
};
export type FileRow = {
  id: string; deal_id: string; uploaded_by: string; kind: string; name: string; mime: string;
  size: number; parts: number; complete: boolean; visitor: string | null; created_at: string;
};
type Failure = { error: string; status: number };
const fail = (error: string, status = 400): Failure => ({ error, status });

/** The deal, if this user is one of its two sides or is operations. */
export async function roomFor(dealId: string, u: User): Promise<Room | null> {
  if (!isId(dealId)) return null;
  const d = await one<Omit<Room, 'role'>>(
    `select d.id, d.stage, r.buyer_id, l.seller_id, (d.buyer_nda_at is not null and d.seller_nda_at is not null) as signed
       from deals d join matches m on m.id = d.match_id join requests r on r.id = m.request_id join listings l on l.id = m.listing_id
      where d.id = $1`, [dealId]);
  if (!d) return null;
  const role = u.id === d.buyer_id ? 'buyer' : u.id === d.seller_id ? 'seller' : u.role === 'admin' ? 'admin' : null;
  return role ? { ...d, role } : null;
}

export { mayAdd, mayOpen };

// ---------- the demo ----------
export const isSample = (u: Pick<User, 'email'>) => u.email.endsWith('.test');

/** The id this browser carries in the demo, if it has one yet. */
export async function visitor(): Promise<string | null> {
  const v = (await cookies()).get('vid')?.value;
  return v && isId(v) ? v : null;
}
/** The same, giving the browser an id when it has none. Only where the response can set a cookie. */
async function ensureVisitor(): Promise<string> {
  const jar = await cookies();
  const v = jar.get('vid')?.value;
  if (v && isId(v)) return v;
  const id = crypto.randomUUID();
  jar.set('vid', id, { ...SESSION, maxAge: 60 * 60 * 24 * 30 });
  return id;
}

/** Demo files are kept for a day. An upload that never finished is dropped after an hour. */
export async function sweep() {
  await q(
    `delete from deal_files
      where (visitor is not null and created_at < now() - make_interval(hours => $1::int))
         or (not complete and created_at < now() - interval '1 hour')`, [DEMO_KEEP_HOURS]);
}

// ---------- adding ----------
/**
 * Make room for a new file and return its id. Its parts are sent next, one request each.
 * The checks on how much a deal and the demo may hold run one upload at a time, so two that start
 * together cannot both take the last of the space.
 */
export async function reserve(room: Room, u: User, input: { kind: unknown; name: unknown; size: unknown }): Promise<{ id: string; parts: number } | Failure> {
  if (!mayAdd(room)) return fail('closed', 403);
  const kind = String(input.kind ?? ''), name = cleanName(String(input.name ?? '')), size = Number(input.size);
  if (!FILE_KINDS.some(k => k[0] === kind)) return fail('kind');
  if (!name || name.startsWith('.')) return fail('name');
  const mime = fileType(name);
  if (!mime) return fail('type');
  if (!Number.isInteger(size) || size <= 0) return fail('empty');
  if (size > MAX_FILE_BYTES) return fail('size', 413);
  const browser = isSample(u) ? await ensureVisitor() : null;
  await sweep();

  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select pg_advisory_xact_lock(hashtext('gridstock.deal_files'))`);
    const { rows: [held] } = await c.query(
      `select (select count(*)::int from deal_files where deal_id = $1) as files,
              (select coalesce(sum(size), 0)::float8 from deal_files where visitor is not null) as demo`, [room.id]);
    const full = held.files >= MAX_FILES_PER_DEAL ? 'count' : browser && held.demo + size > DEMO_STORE_BYTES ? 'full' : null;
    if (full) {
      await c.query('rollback');
      return fail(full, 409);
    }
    const parts = partsFor(size);
    const { rows: [row] } = await c.query(
      `insert into deal_files (deal_id, uploaded_by, kind, name, mime, size, parts, visitor) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [room.id, u.id, kind, name, mime, size, parts, browser]);
    await c.query('commit');
    return { id: String(row.id), parts };
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Store one part of a file that was reserved by the same account, from the same browser in the demo.
 * A part must be exactly the size its place in the file calls for, so a file can never grow past what was reserved.
 * When the last part is in, the file becomes visible to the deal.
 */
export async function storePart(room: Room, u: User, fileId: string, seq: number, data: Buffer): Promise<{ done: boolean } | Failure> {
  if (!mayAdd(room)) return fail('closed', 403);
  if (!isId(fileId)) return fail('failed', 404);
  const f = await one<FileRow>(`select * from deal_files where id = $1 and deal_id = $2 and uploaded_by = $3 and not complete`, [fileId, room.id, u.id]);
  if (!f || (f.visitor != null && f.visitor !== (await visitor()))) return fail('failed', 404);
  if (!Number.isInteger(seq) || seq < 0 || seq >= f.parts) return fail('failed');
  if (data.length !== partSize(f.size, seq)) return fail('failed');
  await q(
    `insert into deal_file_parts (file_id, seq, data) values ($1,$2,$3) on conflict (file_id, seq) do update set data = excluded.data`,
    [f.id, seq, data]);
  const done = await one<{ id: string }>(
    `update deal_files set complete = true
      where id = $1 and not complete and parts = (select count(*) from deal_file_parts where file_id = $1) returning id`, [f.id]);
  if (done) await announce(room, u, f);
  return { done: !!done };
}

/** Tell the deal that a document arrived. The file's own name stays out of the log and the inbox. */
async function announce(room: Room, u: User, f: FileRow) {
  const what = (FILE_KINDS.find(k => k[0] === f.kind)?.[1] ?? 'Document').toLowerCase();
  const by = u.id === room.buyer_id ? 'buyer' : 'seller';
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1, null, $2)`,
    [room.id, `The ${by} added a document: ${what}, ${fileSize(f.size)}.`]);
  await q(`insert into notifications (user_id, body, link) values ($1,$2,$3)`,
    [by === 'buyer' ? room.seller_id : room.buyer_id, `The ${by} added a document to a deal room: ${what}.`, `/deals/${room.id}#documents`]);
  await q(`update deals set updated_at = now() where id = $1`, [room.id]);
}

// ---------- opening ----------
/** A finished file in this deal, if this user may open it from this browser. */
export async function fileFor(room: Room, u: User, fileId: string): Promise<FileRow | null> {
  if (!isId(fileId)) return null;
  const f = await one<FileRow & { expired: boolean }>(
    `select f.*, (f.visitor is not null and f.created_at < now() - make_interval(hours => $3::int)) as expired
       from deal_files f where f.id = $1 and f.deal_id = $2 and f.complete`, [fileId, room.id, DEMO_KEEP_HOURS]);
  if (!f || f.expired) return null;
  return mayOpen(room, u.id, f, await visitor()) ? f : null;
}

/** The bytes of a file, read from the database one part at a time so the whole file is never held in memory. */
export function fileStream(f: Pick<FileRow, 'id' | 'parts'>): ReadableStream<Uint8Array> {
  let seq = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (seq >= f.parts) return controller.close();
      const part = await one<{ data: Buffer }>(`select data from deal_file_parts where file_id = $1 and seq = $2`, [f.id, seq++]);
      if (!part) return controller.error(new Error('A part of the file is missing.'));
      controller.enqueue(new Uint8Array(part.data.buffer, part.data.byteOffset, part.data.byteLength));
    },
  });
}

/** The header that makes a browser save a file under its own name, whatever characters the name holds. */
export function attachment(name: string) {
  const plain = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const exact = encodeURIComponent(name).replace(/['()*]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${plain}"; filename*=UTF-8''${exact}`;
}
