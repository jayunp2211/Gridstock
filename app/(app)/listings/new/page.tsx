import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { fieldError, STATES } from '@/lib/labels';
import { createListing } from '@/app/actions';
import { Arrow } from '@/components/ui';
import { ListingSpec } from '@/components/spec-fields';

export const metadata = { title: 'List gear' };

export default async function NewListing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser('seller');
  const { error } = await searchParams;
  return (
    <>
      <Link href="/listings" className="back"><Arrow />My listings</Link>
      <div className="head">
        <div>
          <h1>List gear</h1>
          <p>Enter what is on the nameplate. Buyers are matched on voltage and size first, so those matter most. The fields change with the category.</p>
        </div>
      </div>
      {error && <div className="notice" role="alert">{fieldError(error)}</div>}
      <form action={createListing} className="stack sheet">
        <ListingSpec />
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
        <div><button className="go">Save and match</button></div>
      </form>
    </>
  );
}
