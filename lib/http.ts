/**
 * Whether a request that changes something came from one of this site's own pages.
 * The session cookie is not sent with a post from another site, so this is a second lock on the same door.
 * It is the check Next.js itself applies to form actions: the page's origin must be the host that was asked.
 */
export function ownPage(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') return origin == null;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
