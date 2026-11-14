// Documents in a deal room: what can be uploaded, how large, and how a file's name is made safe to store and send back.
// No server code here, so the upload form in the browser and the routes on the server share one set of rules.

export const FILE_KINDS: [string, string][] = [
  ['submittal', 'Submittal or drawing'],
  ['test_report', 'Factory test report'],
  ['nameplate', 'Nameplate or photo'],
  ['warranty', 'Warranty letter'],
  ['storage', 'Storage record'],
  ['spec', 'Buyer spec or single-line diagram'],
  ['inspection', 'Inspection report'],
  ['other', 'Other'],
];

const MB = 1024 * 1024;
/** The largest file a deal room takes. A download travels as one streamed response, which the host caps at 20 MB. */
export const MAX_FILE_BYTES = 15 * MB;
/** A file travels up in parts of this size. The host accepts about 4.5 MB of binary data in one request. */
export const PART_BYTES = 3 * MB;
/** Without JavaScript the browser sends the whole file in one request, so it has to be smaller. */
export const ONE_SHOT_BYTES = 4 * MB;
export const MAX_FILES_PER_DEAL = 30;
/** The demo is open to everyone, so everything uploaded there shares one allowance and is deleted after a day. */
export const DEMO_STORE_BYTES = 150 * MB;
export const DEMO_KEEP_HOURS = 24;

// Only these are stored. Each is sent back as a download with exactly this type, never as a page the browser would run.
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic',
  dwg: 'application/acad', dxf: 'application/dxf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
  txt: 'text/plain',
};
export const ACCEPT = Object.keys(TYPES).map(e => `.${e}`).join(',');
export const ACCEPT_WORDS = 'PDF, images, drawings (DWG, DXF), Word, Excel or CSV';

/** The stored type for a file name, or null when its extension is not on the list. */
export function fileType(name: string): string | null {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(name.trim())?.[1].toLowerCase();
  return ext && Object.hasOwn(TYPES, ext) ? TYPES[ext] : null;
}

/** A file name with any folder path, control characters and awkward punctuation removed, at most 120 characters. */
export function cleanName(name: string): string {
  // The path goes first, then line breaks and tabs become spaces, then whatever else a file name should not hold is dropped.
  const base = name.replace(/^[\s\S]*[\\/]/, '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  if (base.length <= 120) return base;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot) : '';
  return base.slice(0, 120 - ext.length).trimEnd() + ext;
}

/** 840 KB, 2.4 MB */
export function fileSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / MB;
  return `${mb >= 10 ? Math.round(mb) : Number(mb.toFixed(1))} MB`;
}

/** How many parts a file of this size travels in. */
export const partsFor = (bytes: number) => Math.max(1, Math.ceil(bytes / PART_BYTES));
/** The exact size part `seq` must have. */
export const partSize = (bytes: number, seq: number) => Math.min(PART_BYTES, bytes - seq * PART_BYTES);

/** What to tell someone when an upload is refused. Keyed by a code, so nothing from the request is echoed back. */
const FILE_ERRORS: Record<string, string> = {
  type: `That kind of file is not accepted. Send ${ACCEPT_WORDS}.`,
  size: `That file is too large. The limit is ${MAX_FILE_BYTES / MB} MB for each file.`,
  one_shot: `That file is too large to send this way. Files over ${ONE_SHOT_BYTES / MB} MB need JavaScript switched on in the browser.`,
  empty: 'That file is empty.',
  name: 'That file has no usable name. Rename it and try again.',
  kind: 'Choose what kind of document it is.',
  count: `This deal room already holds ${MAX_FILES_PER_DEAL} documents. Remove one first.`,
  full: 'The demo has no room for more files right now. Reset the demo from Operations, or try again tomorrow.',
  closed: 'Documents can be added once both sides have accepted the NDA, and until the deal ends.',
  demo: 'In the demo, a file can be opened only from the browser that uploaded it.',
  failed: 'The upload did not finish. Try again.',
};
export const fileError = (code: string) => (Object.hasOwn(FILE_ERRORS, code) ? FILE_ERRORS[code] : FILE_ERRORS.failed);

// ---------- who may add a document, and who may open one ----------
/** What the rules need to know about the viewer's place in a deal. `signed` means both sides have accepted the NDA. */
export type Access = { role: 'buyer' | 'seller' | 'admin'; signed: boolean; stage: string };

/** Documents are added by the two sides, after the NDA, while the deal is running. */
export const mayAdd = (a: Access) => a.role !== 'admin' && a.signed && !['closed', 'lost'].includes(a.stage);

/**
 * Whether this viewer, in this browser, may open a file or see its name.
 * Once a deal has ended without a sale, each side keeps its own documents and loses the other side's.
 * A file added in the demo carries the id of the browser that added it, and no other browser gets it, whichever account it uses.
 */
export function mayOpen(a: Access, viewerId: string, f: { uploaded_by: string; visitor: string | null }, browser: string | null) {
  if (a.role !== 'admin' && !a.signed) return false;
  if (a.stage === 'lost' && a.role !== 'admin' && f.uploaded_by !== viewerId) return false;
  return f.visitor == null || f.visitor === browser;
}
