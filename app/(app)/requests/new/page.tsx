import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS, fieldError, STATES } from '@/lib/labels';
import { createRequest } from '@/app/actions';
import { Arrow } from '@/components/ui';

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
          <p>Voltage class, minimum amperage and condition are hard requirements. Everything else ranks matches and flags gaps.</p>
        </div>
      </div>
      {error && <div className="notice" role="alert">{fieldError(error)}</div>}
      <form action={createRequest} className="stack sheet">
        <fieldset>
          <legend>What you need</legend>
          <div className="fields">
            <label>Category<select name="category" required>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Quantity<input name="quantity" type="number" defaultValue={1} min={1} max={500} step={1} required /></label>
            <label>Site<select name="site_state" required defaultValue=""><option value="" disabled>Choose a state</option>{STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Required ratings</legend>
          <div className="fields">
            <label><span>System voltage (V) <span className="hint">13800 for 13.8 kV</span></span><input name="voltage_v" type="number" required min={100} max={800000} step={1} placeholder="480" /></label>
            <label>Minimum current (A)<input name="amps_min" type="number" required min={1} max={20000} step={1} placeholder="4000" /></label>
            <label><span>Minimum kAIC <span className="hint">optional</span></span><input name="kaic_min" type="number" min={1} max={250} step={1} placeholder="65" /></label>
          </div>
          <div className="fields">
            <label>Enclosure<input name="enclosure" maxLength={30} placeholder="NEMA 1" /></label>
            <label><span>Acceptable OEMs <span className="hint">comma separated, blank for any</span></span><input name="acceptable_oems" maxLength={300} placeholder="Eaton, Schneider Electric, ABB" /></label>
          </div>
          <div role="group" aria-labelledby="cond-label" className="group">
            <span id="cond-label" className="group-label">Acceptable condition</span>
            <div className="choices">
              {CONDITIONS.map(([v, l]) => <label key={v}><input type="checkbox" name="conditions_ok" value={v} defaultChecked={v !== 'used'} />{l}</label>)}
            </div>
          </div>
        </fieldset>
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
