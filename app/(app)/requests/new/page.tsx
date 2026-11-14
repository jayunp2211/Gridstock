import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { fieldError } from '@/lib/labels';
import { createRequest } from '@/app/actions';
import { Arrow } from '@/components/ui';
import { RequestSpec } from '@/components/spec-fields';

export default async function NewRequest({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser('buyer');
  const { error } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Link href="/requests" className="back"><Arrow />My requests</Link>
      <div className="head">
        <div>
          <h1>Post a need</h1>
          <p>Voltage, minimum size and condition are hard requirements. Everything else ranks matches and flags gaps.</p>
        </div>
      </div>
      {error && <div className="notice" role="alert">{fieldError(error)}</div>}
      <form action={createRequest} className="stack sheet">
        <RequestSpec />
        <fieldset>
          <legend>Schedule and budget</legend>
          <div className="fields">
            <label><span>Need by <span className="hint">energization date</span></span><input name="need_by" type="date" required min={today} /></label>
            <label><span>Budget ceiling (USD) <span className="hint">for the whole quantity, optional</span></span><input name="budget_max" inputMode="numeric" pattern="[\d,$ ]*" maxLength={16} placeholder="900,000" /></label>
          </div>
          <label><span>Notes <span className="hint">project context, utility requirements</span></span><textarea name="notes" maxLength={2000} /></label>
          <p className="soft small">Your budget and notes are never shown to sellers, and budget plays no part in the fit score.</p>
        </fieldset>
        <div><button className="go">Find matches<Arrow /></button></div>
      </form>
    </>
  );
}
