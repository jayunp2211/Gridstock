import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CATEGORIES, CONDITIONS } from '@/lib/labels';
import { createListing } from '@/app/actions';

export default async function NewListing() {
  await requireUser('seller');
  return (
    <>
      <Link href="/listings" className="back">← My listings</Link>
      <div className="page-head">
        <div>
          <span className="eyebrow">Seller</span>
          <h1>List gear</h1>
          <p className="lead">Enter what is on the nameplate. Buyers match on voltage, amperage and interrupting rating, so those matter most.</p>
        </div>
      </div>
      <form action={createListing} className="card stack form-card">
        <fieldset>
          <legend>Equipment</legend>
          <div className="fields">
            <label>Category<select name="category" required>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>OEM<input name="oem" required placeholder="Eaton" /></label>
            <label>Model or line<input name="model" placeholder="Magnum DS" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Nameplate ratings</legend>
          <div className="fields">
            <label>Voltage (V)<input name="voltage_v" type="number" required placeholder="480" /></label>
            <label>Rated current (A)<input name="amps" type="number" required placeholder="4000" /></label>
            <label>Interrupting rating (kAIC)<input name="kaic" type="number" placeholder="65" /></label>
          </div>
          <div className="fields">
            <label>Enclosure<input name="enclosure" placeholder="NEMA 1" /></label>
            <label>Standard<input name="standard" placeholder="UL 1558" /></label>
            <label>Condition<select name="condition">{CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Availability</legend>
          <div className="fields">
            <label>Quantity<input name="quantity" type="number" defaultValue={1} min={1} /></label>
            <label>Location (state)<input name="location_state" required maxLength={2} placeholder="TX" /></label>
            <label>Available from<input name="available_date" type="date" required /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Commercial, private until NDA</legend>
          <div className="fields">
            <label>Asking price (USD) <span className="hint">optional</span><input name="asking_price" inputMode="numeric" placeholder="1,200,000" /></label>
            <label>Warranty status<input name="warranty_status" placeholder="OEM warranty to 2027-06" /></label>
          </div>
          <label>Notes <span className="hint">storage conditions, documents on hand</span><textarea name="notes" /></label>
        </fieldset>
        <div><button className="primary">Save and match</button></div>
      </form>
    </>
  );
}
