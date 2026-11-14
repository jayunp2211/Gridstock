// One document in a deal room: its parts on the way in, and the whole file on the way out.
import { currentUser } from '@/lib/auth';
import { PART_BYTES } from '@/lib/files';
import { attachment, fileFor, fileStream, roomFor, storePart } from '@/lib/deal-files';
import { ownPage } from '@/lib/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; fileId: string }> };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const gone = () => new Response('This document does not exist, or it cannot be opened from here.', {
  status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

/** One part of a file, as raw bytes. `?seq=` says which part it is, counting from 0. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  if (!ownPage(req)) return json({ error: 'failed' }, 403);
  const u = await currentUser();
  if (!u) return json({ error: 'failed' }, 401);
  const room = await roomFor(id, u);
  if (!room) return json({ error: 'failed' }, 404);
  if (Number(req.headers.get('content-length') ?? 0) > PART_BYTES) return json({ error: 'failed' }, 413);
  const seq = Number(new URL(req.url).searchParams.get('seq') ?? 'x');
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length > PART_BYTES) return json({ error: 'failed' }, 413);
  const stored = await storePart(room, u, fileId, seq, data);
  return 'error' in stored ? json({ error: stored.error }, stored.status) : json(stored);
}

/**
 * The file itself. It is always sent as a download under the type its extension stands for,
 * never as something the browser would display or run on this site.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const u = await currentUser();
  if (!u) return new Response(null, { status: 303, headers: { Location: '/login' } });
  const room = await roomFor(id, u);
  const f = room ? await fileFor(room, u, fileId) : null;
  if (!f) return gone();
  return new Response(fileStream(f), {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': attachment(f.name),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  });
}
