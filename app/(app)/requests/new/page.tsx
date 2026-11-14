import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS } from '@/lib/labels';
import { createRequest } from '@/app/actions';

export default async function NewRequest() {
  await requireUser('buyer');
  return (
    <>
      <Link href="/requests" className="back">← My requests</Link>
      <div className="page-head">
        <div>
          <span className="eyebrow">Buyer</span>
          <h1>Post a need</h1>
          <p className="lead">Voltage, minimum amperage and condition are hard requirements. Everything else ranks matches and flags gaps.</p>
        </div>
      </div>
      <form action={createRequest} className="card stack form-card">
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
            <label>Acceptable OEMs <span className="hint">comma separated, blank for any</span><input name="acceptable_oems" placeholder="Eaton, Schneider, ABB" /></label>
          </div>
          <label>Acceptable condition
            <div className="checks">
              {CONDITIONS.map(([v, l]) => <label key={v}><input type="checkbox" name="conditions_ok" value={v} defaultChecked={v !== 'used'} /> {l}</label>)}
            </div>
          </label>
        </fieldset>
        <fieldset>
          <legend>Schedule and budget</legend>
          <div className="fields">
            <label>Need by <span className="hint">energization date</span><input name="need_by" type="date" required /></label>
            <label>Budget ceiling (USD) <span className="hint">optional</span><input name="budget_max" inputMode="numeric" placeholder="900,000" /></label>
          </div>
          <label>Notes <span className="hint">project context, utility requirements</span><textarea name="notes" /></label>
        </fieldset>
        <div><button className="primary">Find matches</button></div>
      </form>
    </>
  );
}
