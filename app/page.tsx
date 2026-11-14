import Link from 'next/link';
import { q } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { CONDITIONS, label } from '@/lib/labels';
import { regionOf } from '@/lib/match';
import { Spec, Arrow, cat, month } from '@/components/ui';

export const dynamic = 'force-dynamic';

// The public boards show ratings and a coarse region only.
// Seller, buyer, exact location, model, price and notes are never selected here.
type Gear = { id: string; category: string; oem: string; voltage_v: number; amps: number; kaic: number | null;
  enclosure: string | null; condition: string; quantity: number; location_state: string; available_date: string };
type Need = { id: string; category: string; voltage_v: number; amps_min: number; kaic_min: number | null;
  enclosure: string | null; quantity: number; site_state: string; need_by: string };

async function boards(): Promise<{ gear: Gear[]; needs: Need[] }> {
  try {
    const [gear, needs] = await Promise.all([
      q<Gear>(`select id, category, oem, voltage_v, amps, kaic, enclosure, condition, quantity, location_state, available_date
               from listings where status = 'active' order by available_date, created_at limit 8`),
      q<Need>(`select id, category, voltage_v, amps_min, kaic_min, enclosure, quantity, site_state, need_by
               from requests where status = 'open' order by need_by, created_at limit 8`),
    ]);
    return { gear, needs };
  } catch {
    return { gear: [], needs: [] };
  }
}

const COURSE: [string, string][] = [
  ['List or post', 'Owners enter what is on the nameplate. Builders post the spec they need and the date they must energize.'],
  ['Match by spec', 'Voltage, amperage, interrupting rating and condition are checked. You get a fit score out of 100 and the exact gaps.'],
  ['Meet under NDA', 'Names and pricing stay hidden until both sides sign. Then documents, test reports and offers move in one room.'],
  ['Inspect and close', 'An independent testing firm checks the gear before funds leave escrow and it ships to site.'],
];

export default async function Home() {
  const [u, { gear, needs }] = await Promise.all([currentUser().catch(() => null), boards()]);
  const buy = u?.role === 'buyer' ? '/requests/new' : '/login?role=buyer';
  const sell = u?.role === 'seller' ? '/listings/new' : '/login?role=seller';

  return (
    <main>
      <section className="frame hero">
        <h1 className="display">The switchgear you need is sitting in a crate.</h1>
        <div className="hero-foot">
          <p className="sub">
            Gridstock is a private market for new and never-energized electrical and cooling equipment from paused
            data center projects, matched to your spec and your energization date.
          </p>
          <div className="actions">
            <Link href="#available" className="btn go">See what is available<Arrow /></Link>
            <Link href={sell} className="u">List gear you hold</Link>
          </div>
        </div>
      </section>

      <section className="frame board" id="available">
        <div className="board-head">
          <h2>Available now</h2>
          <span className="soft">{gear.length ? `${gear.length} listed, soonest first` : 'Nothing listed today'}</span>
        </div>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Equipment</th><th className="wide-only">Make</th><th className="wide-only">Rating</th>
                <th className="wide-only">Condition</th><th className="wide-only">Qty</th><th className="wide-only">Region</th>
                <th>Available</th><th><span className="vh">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {gear.map(g => (
                <tr key={g.id}>
                  <td className="lead-cell">
                    {cat(g.category)}
                    <div className="narrow-only under">{g.oem}, {regionOf(g.location_state)}<Spec x={g} /></div>
                  </td>
                  <td className="wide-only">{g.oem}</td>
                  <td className="wide-only"><Spec x={g} /></td>
                  <td className="wide-only">{label(CONDITIONS, g.condition)}</td>
                  <td className="wide-only num">{g.quantity}</td>
                  <td className="wide-only">{regionOf(g.location_state)}</td>
                  <td className="num">{month(g.available_date)}</td>
                  <td><Link href={buy}>Request</Link></td>
                </tr>
              ))}
              {gear.length === 0 && (
                <tr><td colSpan={8} className="empty">Post your spec and you will hear the moment matching gear is listed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="board-note soft small">
          Sellers, exact locations and prices stay hidden until both sides sign an NDA. Post your spec to see how each
          unit fits it.
        </p>
      </section>

      <section className="on-ink">
        <div className="frame">
          <p className="statement">
            New medium-voltage switchgear takes 52 to 104 weeks to arrive, up from about 24 before 2020. About half of
            the US data center builds planned for 2026 are projected to be delayed or cancelled. The equipment those
            projects ordered is already built.
          </p>
          <p className="cite soft small">Sources: IndustrialSage (Sep 2026), Wood Mackenzie via Reuters (Jul 2026), Bloomberg (Apr 2026).</p>

          <div className="split wanted" id="wanted">
            <div className="intro">
              <h2>Wanted</h2>
              <p className="soft">Builders with a utility date and no gear. If you hold something close to one of these, it is worth listing even if it is not an exact fit.</p>
              <Link href={sell} className="btn line">List gear you hold<Arrow /></Link>
            </div>
            <div className="scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Equipment</th><th className="wide-only">Minimum rating</th><th className="wide-only">Qty</th>
                    <th className="wide-only">Site</th><th>Need by</th><th><span className="vh">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {needs.map(n => (
                    <tr key={n.id}>
                      <td className="lead-cell">
                        {cat(n.category)}
                        <div className="narrow-only under">{regionOf(n.site_state)}, minimum rating<Spec x={n} plain /></div>
                      </td>
                      <td className="wide-only"><Spec x={n} plain /></td>
                      <td className="wide-only num">{n.quantity}</td>
                      <td className="wide-only">{regionOf(n.site_state)}</td>
                      <td className="num">{month(n.need_by)}</td>
                      <td><Link href={sell}>Offer yours</Link></td>
                    </tr>
                  ))}
                  {needs.length === 0 && <tr><td colSpan={6} className="empty">No open requests today.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="frame section split" id="how">
        <div className="intro">
          <h2>How a deal runs</h2>
          <p className="soft">Switchgear, switchboards, breakers, transformers, UPS, coolant distribution units and chillers all move the same way.</p>
        </div>
        <ol className="course">
          {COURSE.map(([stage, text]) => (
            <li key={stage}><span className="stage">{stage}</span><p>{text}</p></li>
          ))}
        </ol>
      </section>

      <section className="frame close">
        <h2 className="ask">Holding gear from a paused project, or racing a utility date?</h2>
        <div>
          <div className="actions">
            <Link href={buy} className="btn go">Post a need<Arrow /></Link>
            <Link href={sell} className="btn line">List gear</Link>
          </div>
          <p className="soft small">Free to list. Confidential until NDA.</p>
        </div>
      </section>
    </main>
  );
}
