import { appointInspector, confirmEscrow, fundEscrow, recordInspection, releaseEscrow } from '@/app/actions';
import { money } from '@/lib/labels';
import { NETA } from '@/lib/site';
import { day } from '@/components/ui';

export type StepDeal = {
  id: string; stage: string; offer_price: number | null;
  inspector: string | null; inspection_day: string | null; inspection_result: string | null; inspection_at: string | null;
  escrow_agent: string | null; escrow_funded_at: string | null; escrow_confirmed_at: string | null; escrow_released_at: string | null;
  updated_at: string;
};

const STEP_ERRORS: Record<string, string> = {
  inspector: 'Name the inspection firm in 120 characters or fewer, and give a valid date or leave the date blank.',
  who: 'Name the firm that inspected the equipment before you record that it passed.',
  agent: 'Name the escrow agent in 120 characters or fewer.',
};

/** Whether a deal has anything to show under inspection and escrow. */
export const hasSteps = (d: StepDeal) =>
  ['inspection', 'escrow', 'closed'].includes(d.stage) || !!(d.inspector || d.inspection_result || d.escrow_agent);

const none = (text: string) => <span className="soft">{text}</span>;
const on = (date: string | null) => (date ? <div className="soft small">{day(date)}</div> : null);

/**
 * Inspection and escrow, as the two sides run them. The left column is the record so far.
 * The right column is the one thing the viewer does next, or what they are waiting for.
 */
export function Steps({ d, side, fee, error }: { d: StepDeal; side: 'buyer' | 'seller' | 'admin'; fee: number | null; error?: string }) {
  const price = money(d.offer_price);
  const agent = d.escrow_agent ?? 'the escrow agent';
  const planned = d.inspection_day ? `, planned for ${day(d.inspection_day)}` : '';
  const escrowShown = ['escrow', 'closed'].includes(d.stage) || !!d.escrow_agent;
  const id = <input type="hidden" name="deal_id" value={d.id} />;
  const buyer = side === 'buyer', seller = side === 'seller';

  let step: React.ReactNode = null;
  if (d.stage === 'inspection') {
    step = buyer ? (
      <>
        <h3>{d.inspector ? 'Your step: record the inspection result' : 'Your step: appoint an independent inspector'}</h3>
        <p>
          Choose a testing firm that neither side owns, and tell the seller when it will visit.{' '}
          <a href={NETA.href} rel="noopener">{NETA.label}</a> accredits independent electrical testing firms and lists them.
        </p>
        <form action={appointInspector} className="step-form">
          {id}
          <label>Inspection firm<input name="inspector" defaultValue={d.inspector ?? ''} minLength={2} maxLength={120} required /></label>
          <label><span>Planned date <span className="hint">optional</span></span><input name="inspection_on" type="date" defaultValue={d.inspection_day ?? ''} /></label>
          <button className={d.inspector ? 'line' : undefined}>{d.inspector ? 'Change inspector' : 'Appoint inspector'}</button>
        </form>
        <form action={recordInspection} className="stack result">
          {id}
          <div className="group">
            <span className="group-label">Result</span>
            <div className="choices column">
              <label><input type="radio" name="result" value="passed" required />It passed. I accept the equipment.</label>
              <label><input type="radio" name="result" value="waived" />I waive the inspection and accept the equipment as it is.</label>
              <label><input type="radio" name="result" value="failed" />It did not pass.</label>
            </div>
          </div>
          <label><span>Note for the seller <span className="hint">optional</span></span><input name="note" maxLength={300} /></label>
          <div><button className="go">Record result</button></div>
        </form>
        <p className="soft small">
          Accepting the equipment moves the deal to escrow. If it did not pass, the agreed price is set aside and the units are open
          again, so either side can make a new offer or leave.
        </p>
      </>
    ) : (
      <>
        <h3>{seller ? 'Waiting for the buyer’s inspection' : 'With the buyer: inspection'}</h3>
        <p>
          {d.inspector
            ? `The buyer appointed ${d.inspector}${planned}. ${seller ? 'Give the firm access to the equipment. ' : ''}The buyer records the result here.`
            : `The buyer appoints an independent testing firm${seller ? ' and tells you when it will visit' : ''}. The buyer can also waive the inspection.`}
        </p>
      </>
    );
  } else if (d.stage === 'escrow') {
    if (!d.escrow_funded_at) {
      step = buyer ? (
        <>
          <h3>Your step: deposit the price in escrow</h3>
          <p>
            Agree a licensed escrow agent with the seller. Deposit {price} with that agent, under instructions to release it to the
            seller when you confirm delivery, then record the deposit here. Gridstock does not hold or move the money.
          </p>
          <form action={fundEscrow} className="step-form single">
            {id}
            <label>Escrow agent<input name="escrow_agent" minLength={2} maxLength={120} required /></label>
            <button className="go">Record the deposit</button>
          </form>
        </>
      ) : (
        <>
          <h3>{seller ? 'Waiting for the buyer’s deposit' : 'With the buyer: deposit'}</h3>
          <p>
            The buyer deposits {price} with a licensed escrow agent that both sides agree on, and records it here.
            {seller ? ' You then check with the agent yourself before you ship. Gridstock does not hold or move the money.' : ''}
          </p>
        </>
      );
    } else if (!d.escrow_confirmed_at) {
      step = seller ? (
        <>
          <h3>Your step: confirm the deposit</h3>
          <p>
            The buyer reports {price} deposited with {agent}. Check with {agent} directly that it holds the funds and what releases
            them. Confirm here only once you have, because this is your signal to ship.
          </p>
          <form action={confirmEscrow}>{id}<button className="go">Confirm the funds are held</button></form>
        </>
      ) : (
        <>
          <h3>{buyer ? 'Waiting for the seller to confirm' : 'With the seller: confirm the deposit'}</h3>
          <p>The seller checks with {agent} that the funds are held, and ships once that is confirmed.</p>
        </>
      );
    } else {
      step = buyer ? (
        <>
          <h3>Your step: confirm delivery</h3>
          <p>
            When the equipment has arrived and you have told {agent} to release the funds to the seller, confirm it here.
            That closes the deal, and it cannot be undone from this page.
          </p>
          <form action={releaseEscrow}>{id}<button className="go">Confirm delivery and release</button></form>
        </>
      ) : (
        <>
          <h3>{seller ? 'Your step: ship the equipment' : 'With the seller: shipping'}</h3>
          <p>{agent} holds the funds. The buyer confirms delivery here and tells the agent to release them, which closes the deal.</p>
        </>
      );
    }
  } else if (d.stage === 'closed') {
    step = (
      <>
        <h3>Closed</h3>
        <p>
          {d.escrow_released_at ? `The buyer confirmed delivery on ${day(d.escrow_released_at)}.` : 'Gridstock operations closed this deal.'}{' '}
          {fee == null ? '' : buyer ? `Gridstock will invoice you for the fee of ${money(fee)}.`
            : seller ? 'There is no fee for the seller.' : `The buyer owes a fee of ${money(fee)}.`}
        </p>
      </>
    );
  } else if (d.stage === 'offer' && d.inspection_result === 'failed') {
    step = (
      <>
        <h3>The inspection did not pass</h3>
        <p>The agreed price is set aside and the units are open again. Either side can make a new offer above, or leave the deal.</p>
      </>
    );
  }

  return (
    <>
      <h2 id="steps">Inspection and escrow</h2>
      <p className="lede soft">
        The two sides run these steps themselves and each one is recorded here. Gridstock does not inspect the equipment and never
        holds the money.
      </p>
      {error && Object.hasOwn(STEP_ERRORS, error) && <div className="notice" role="alert">{STEP_ERRORS[error]}</div>}
      <div className="pair steps">
        <dl className="facts">
          <dt>Inspector</dt>
          <dd>{d.inspector ? <>{d.inspector}{d.inspection_day && <div className="soft small">Planned for {day(d.inspection_day)}</div>}</> : none('Not appointed')}</dd>
          <dt>Inspection</dt>
          <dd>
            {d.inspection_result === 'passed' ? <>Passed, and the buyer accepted the equipment{on(d.inspection_at)}</>
              : d.inspection_result === 'waived' ? <>Waived by the buyer{on(d.inspection_at)}</>
              : d.inspection_result === 'failed' ? <>Did not pass, the buyer reported{on(d.inspection_at)}</>
              : none('No result yet')}
          </dd>
          {escrowShown && (
            <>
              <dt>Escrow agent</dt><dd>{d.escrow_agent ?? none('Not named yet')}</dd>
              <dt>Deposit</dt><dd>{d.escrow_funded_at ? <>{price}, reported by the buyer{on(d.escrow_funded_at)}</> : none('Not reported yet')}</dd>
              <dt>Funds held</dt><dd>{d.escrow_confirmed_at ? <>Confirmed by the seller{on(d.escrow_confirmed_at)}</> : none('Not confirmed yet')}</dd>
              <dt>Delivery</dt><dd>{d.escrow_released_at ? <>Confirmed by the buyer, funds released{on(d.escrow_released_at)}</> : none('Not confirmed yet')}</dd>
            </>
          )}
        </dl>
        {step && <section className="panel step">{step}</section>}
      </div>
    </>
  );
}
