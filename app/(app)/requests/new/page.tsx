import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS } from '@/lib/labels';
import { createRequest } from '@/app/actions';
import { Arrow } from '@/components/ui';

export default async function NewRequest() {
  await requireUser('buyer');
  return (
    <>
      <Link href="/requests" className="back"><Arrow />My requests</Link>
      <div className="head">
        <div>
          <h1>Post a need</h1>
          <p>Voltage, minimum amperage and condition are hard requirements. Everything else ranks matches and flags gaps.</p>
        </div>
      </div>
      <form action={createRequest} className="stack sheet">
        <fieldset>
          <legend>What you need</legend>
          <div className="fields">
            <label>Category<select name="category" required>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Quantity<input name="quantity" type="number" defaultValue={1} min={1} /></label>
            <label>Site (state)<input name="site_state" required maxLength={2} placeholder="TX" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Required ratings</legend>
          <div className="fields">
            <label>Voltage (V)<input name="voltage_v" type="number" required placeholder="480" /></label>
            <label>Minimum current (A)<input name="amps_min" type="number" required placeholder="4000" /></label>
            <label>Minimum kAIC<input name="kaic_min" type="number" placeholder="65" /></label>
          </div>
          <div className="fields">
            <label>Enclosure<input name="enclosure" placeholder="NEMA 1" /></label>
            <label><span>Acceptable OEMs <span className="hint">comma separated, blank for any</span></span><input name="acceptable_oems" placeholder="Eaton, Schneider, ABB" /></label>
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
            <label><span>Need by <span className="hint">energization date</span></span><input name="need_by" type="date" required /></label>
            <label><span>Budget ceiling (USD) <span className="hint">optional</span></span><input name="budget_max" inputMode="numeric" placeholder="900,000" /></label>
          </div>
          <label><span>Notes <span className="hint">project context, utility requirements</span></span><textarea name="notes" /></label>
        </fieldset>
        <div><button className="go">Find matches<Arrow /></button></div>
      </form>
    </>
  );
}
