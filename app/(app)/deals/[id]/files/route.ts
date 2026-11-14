// Adding a document to a deal room.
//
// With JavaScript the page asks for room first (a small JSON request) and then sends the file in parts
// to files/<id>. Without it the browser sends the whole file here in one form post, which the host
// only allows for small files.
import { currentUser } from '@/lib/auth';
import { ONE_SHOT_BYTES } from '@/lib/files';
import { reserve, roomFor, storePart } from '@/lib/deal-files';
import { ownPage } from '@/lib/http';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
/** Send a form post back to the deal room, with the outcome as a code the page turns into words. */
const back = (dealId: string, code: string) =>
  new Response(null, { status: 303, headers: { Location: `/deals/${dealId}?file=${code}#documents`, 'Cache-Control': 'no-store' } });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = (req.headers.get('content-type') ?? '').startsWith('multipart/form-data');
  if (!ownPage(req)) return json({ error: 'failed' }, 403);
  const u = await currentUser();
  if (!u) return form ? new Response(null, { status: 303, headers: { Location: '/login' } }) : json({ error: 'failed' }, 401);
  const room = await roomFor(id, u);
  if (!room) return json({ error: 'failed' }, 404);

  if (!form) {
    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') return json({ error: 'failed' }, 400);
    const made = await reserve(room, u, input as { kind: unknown; name: unknown; size: unknown });
    return 'error' in made ? json({ error: made.error }, made.status) : json(made);
  }

  // The whole file in one request.
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > ONE_SHOT_BYTES + 64 * 1024) return back(room.id, 'one_shot');
  const data = await req.formData().catch(() => null);
  const file = data?.get('file');
  if (!data || !(file instanceof File) || !file.name) return back(room.id, 'empty');
  if (file.size > ONE_SHOT_BYTES) return back(room.id, 'one_shot');
  const made = await reserve(room, u, { kind: data.get('kind'), name: file.name, size: file.size });
  if ('error' in made) return back(room.id, made.error);
  const stored = await storePart(room, u, made.id, 0, Buffer.from(await file.arrayBuffer()));
  return back(room.id, 'error' in stored ? stored.error : 'added');
}
