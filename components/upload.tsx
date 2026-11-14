'use client';
// The form that adds a document to a deal room.
//
// The host accepts only a few megabytes in one request, so the file is cut into parts here and sent
// one part at a time. Without JavaScript the same form posts the whole file at once, which works
// for small files only.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACCEPT, ACCEPT_WORDS, FILE_KINDS, MAX_FILE_BYTES, PART_BYTES, fileError, fileType, partsFor } from '@/lib/files';

const MB = 1024 * 1024;

async function sendPart(url: string, part: Blob): Promise<string | null> {
  // One more try if the connection drops: a part can be sent again safely.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: part });
      if (res.ok) return null;
      if (res.status < 500) return (await res.json().catch(() => null))?.error ?? 'failed';
    } catch {
      // try once more
    }
  }
  return 'failed';
}

export function Upload({ dealId }: { dealId: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const base = `/deals/${dealId}/files`;

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const file = data.get('file');
    const refuse = (code: string) => setNote({ text: fileError(code), bad: true });
    if (!(file instanceof File) || !file.name) return refuse('empty');
    if (!fileType(file.name)) return refuse('type');
    if (file.size === 0) return refuse('empty');
    if (file.size > MAX_FILE_BYTES) return refuse('size');

    setBusy(true);
    setNote({ text: 'Starting' });
    try {
      const res = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: data.get('kind'), name: file.name, size: file.size }),
      });
      const made = await res.json().catch(() => null);
      if (!res.ok || !made?.id) return refuse(made?.error ?? 'failed');
      const parts = partsFor(file.size);
      for (let seq = 0; seq < parts; seq++) {
        setNote({ text: parts === 1 ? 'Sending' : `Sending part ${seq + 1} of ${parts}` });
        const error = await sendPart(`${base}/${made.id}?seq=${seq}`, file.slice(seq * PART_BYTES, (seq + 1) * PART_BYTES));
        if (error) return refuse(error);
      }
      form.current?.reset();
      setNote({ text: `Added ${file.name}.` });
      router.refresh();
    } catch {
      refuse('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} className="upload" action={base} method="post" encType="multipart/form-data" onSubmit={send}>
      <label>Kind of document
        <select name="kind" defaultValue="" required>
          <option value="" disabled>Choose</option>
          {FILE_KINDS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </select>
      </label>
      <label>File <span className="hint">{ACCEPT_WORDS}, up to {MAX_FILE_BYTES / MB} MB</span>
        <input type="file" name="file" accept={ACCEPT} required />
      </label>
      <button disabled={busy}>{busy ? 'Adding' : 'Add document'}</button>
      <p className={note?.bad ? 'upload-note bad' : 'upload-note soft'} role="status" aria-live="polite">{note?.text}</p>
    </form>
  );
}
