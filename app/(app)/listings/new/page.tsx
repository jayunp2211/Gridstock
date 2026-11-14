import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS, fieldError, OEMS, STATES } from '@/lib/labels';
import { createListing } from '@/app/actions';
import { Arrow } from '@/components/ui';

export default async function NewListing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser('seller');
  const { error } = await searchParams;
  return (
    <>
      <Link href="/listings" className="back"><Arrow />My listings</Link>
      <div className="head">
        <div>
          <h1>List gear</h1>
          <p>Enter what is on the nameplate. Buyers match on voltage, amperage and interrupting rating, so those matter most.</p>
        </div>
      </div>
      {error && <div className="notice" role="alert">{fieldError(error)}</div>}
      <form action={createListing} className="stack sheet">
        <fieldset>
          <legend>Equipment</legend>
          <div className="fields">
            <label>Category<select name="category" required>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>OEM<input name="oem" required maxLength={40} placeholder="Eaton" list="oems" autoComplete="off" /></label>
            <label>Model or line<input name="model" maxLength={60} placeholder="Magnum DS" /></label>
          </div>
          <datalist id="oems">{OEMS.map(o => <option key={o} value={o} />)}</datalist>
        </fieldset>
        <fieldset>
          <legend>Nameplate ratings</legend>
          <div className="fields">
            <label><span>Voltage (V) <span className="hint">13800 for 13.8 kV</span></span><input name="voltage_v" type="number" required min={100} max={800000} step={1} placeholder="480" /></label>
            <label>Rated current (A)<input name="amps" type="number" required min={1} max={20000} step={1} placeholder="4000" /></label>
            <label><span>Interrupting rating (kAIC) <span className="hint">optional</span></span><input name="kaic" type="number" min={1} max={250} step={1} placeholder="65" /></label>
          </div>
          <div className="fields">
            <label>Enclosure<input name="enclosure" maxLength={30} placeholder="NEMA 1" /></label>
            <label>Standard<input name="standard" maxLength={30} placeholder="UL 1558" /></label>
            <label>Condition<select name="condition">{CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Availability</legend>
          <div className="fields">
            <label>Quantity<input name="quantity" type="number" defaultValue={1} min={1} max={500} step={1} required /></label>
            <label>Location<select name="location_state" required defaultValue=""><option value="" disabled>Choose a state</option>{STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Available from<input name="available_date" type="date" required /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Commercial terms, private until NDA</legend>
          <div className="fields">
            <label><span>Asking price (USD) <span className="hint">for all units together, optional</span></span><input name="asking_price" inputMode="numeric" pattern="[\d,$ ]*" maxLength={16} placeholder="1,200,000" /></label>
            <label>Warranty status<input name="warranty_status" maxLength={120} placeholder="OEM warranty, transfer requested" /></label>
          </div>
          <label><span>Notes <span className="hint">storage conditions, documents on hand</span></span><textarea name="notes" maxLength={2000} /></label>
        </fieldset>
        <div><button className="go">Save and match<Arrow /></button></div>
      </form>
    </>
  );
}
