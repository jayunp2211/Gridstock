import Link from 'next/link';
import { q } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { CONDITIONS, label } from '@/lib/labels';
import { regionOf } from '@/lib/match';
import { sampleListings, sampleRequests } from '@/lib/demo';
import { Spec, Arrow, cat, month } from '@/components/ui';

export const dynamic = 'force-dynamic';

// The public boards show ratings and a coarse region only.
// Seller, buyer, exact location, model, price and notes are never selected here.
type Gear = { id: string; category: string; oem: string; voltage_v: number; secondary_v: number | null; amps: number | null; capacity: number | null; kaic: number | null;
  enclosure: string | null; condition: string; quantity: number; location_state: string; available_date: string };
type Need = { id: string; category: string; voltage_v: number; secondary_v: number | null; amps_min: number | null; capacity_min: number | null; kaic_min: number | null;
  enclosure: string | null; quantity: number; site_state: string; need_by: string };

/**
 * Real listings and requests come only from verified accounts. Until there are some, the boards
 * show fixed examples and say so. The examples are built here, not read from the demo's database,
 * so nothing a visitor does in the demo can change this page.
 */
async function boards(): Promise<{ gear: Gear[]; needs: Need[]; sample: boolean }> {
  try {
    const [gear, needs] = await Promise.all([
      q<Gear>(`select l.id, l.category, l.oem, l.voltage_v, l.secondary_v, l.amps, l.capacity, l.kaic, l.enclosure, l.condition, l.quantity, l.location_state, l.available_date
               from listings l join users u on u.id = l.seller_id
               where l.status = 'active' and u.verified and u.email not like '%.test' order by l.available_date, l.created_at limit 8`),
      q<Need>(`select r.id, r.category, r.voltage_v, r.secondary_v, r.amps_min, r.capacity_min, r.kaic_min, r.enclosure, r.quantity, r.site_state, r.need_by
               from requests r join users u on u.id = r.buyer_id
               where r.status = 'open' and u.verified and u.email not like '%.test' order by r.need_by, r.created_at limit 8`),
    ]);
    if (gear.length || needs.length) return { gear, needs, sample: false };
  } catch {
    // The examples below need no database.
  }
  return {
    gear: sampleListings().map((l, i) => ({ ...l, id: `sample-${i}` })).sort((a, b) => a.available_date.localeCompare(b.available_date)),
    needs: sampleRequests().map((r, i) => ({ ...r, id: `sample-${i}` })).sort((a, b) => a.need_by.localeCompare(b.need_by)),
    sample: true,
  };
}

const COURSE: [string, string][] = [
  ['List or post', 'Owners enter what is on the nameplate. Builders post the spec they need and the date they must energize.'],
  ['Match by spec', 'Voltage class, amperage, interrupting rating and condition are checked. You get a fit score out of 100 and the exact gaps. It is a first screen, and the documents settle the rest.'],
  ['Meet under NDA', 'Names and pricing stay hidden until both sides sign. Then submittals, test reports and offers move in one room.'],
  ['Inspect and close', 'An independent testing firm checks the gear before funds leave escrow and it ships to site.'],
];

export default async function Home() {
  const [u, { gear, needs, sample }] = await Promise.all([currentUser().catch(() => null), boards()]);
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
            {u?.role === 'buyer' ? <><Link href="/requests/new" className="btn go">Post a need<Arrow /></Link><Link href="/requests" className="u">My requests</Link></>
              : u?.role === 'seller' ? <><Link href="/listings/new" className="btn go">List gear<Arrow /></Link><Link href="/listings" className="u">My listings</Link></>
              : u ? <Link href="/admin" className="btn go">Open operations<Arrow /></Link>
              : <><Link href="/login" className="btn go">Request access<Arrow /></Link><Link href="/login#demo" className="u">Try the demo</Link></>}
          </div>
        </div>
      </section>

      <section className="frame board" id="available">
        <div className="board-head">
          <h2>{sample ? 'Example listings' : 'Available now'}</h2>
          <span className="soft">{sample ? 'Samples, not live stock' : gear.length ? `${gear.length} listed, soonest first` : 'Nothing listed today'}</span>
        </div>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Equipment</th><th className="wide-only">Make</th><th className="wide-only">Rating</th>
                <th className="wide-only">Condition</th><th className="wide-only">Qty</th><th className="wide-only">Region</th>
                <th>Available</th>{!sample && <th><span className="vh">Action</span></th>}
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
                  {!sample && <td><Link href={buy}>Request</Link></td>}
                </tr>
              ))}
              {gear.length === 0 && (
                <tr><td colSpan={8} className="empty">Post your spec and you will hear the moment matching gear is listed.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="board-note soft small">
          {sample
            ? 'Gridstock is signing up its first sellers and builders, so these rows are examples. A real listing shows the same and no more: ratings and a region, never the seller, the site or the price.'
            : 'Sellers, exact locations and prices stay hidden until both sides sign an NDA. Post your spec to see how each unit fits it.'}
        </p>
      </section>

      <section className="on-ink">
        <div className="frame">
          <p className="statement">
            15 kV switchgear takes 52 to 80 weeks to arrive, up from about 24 before the pandemic. Data center project
            cancellations more than quadrupled in 2025. Developers say the equipment those projects had lined up is
            coming back onto the market.
          </p>
          <p className="cite soft small">
            Sources: <a href="https://www.industrialsage.com/switchgear-lead-times-2026/" rel="noopener">IndustrialSage</a>, Sep 2026, from a contractor&rsquo;s factory slot data.{' '}
            <a href="https://www.utilitydive.com/news/data-center-project-cancellations-power-public-pushback/818204/" rel="noopener">Baird, reported by Utility Dive</a>, Apr 2026.{' '}
            <a href="https://www.bisnow.com/news/national/data-center-development/ai-boom-keeps-data-center-supply-chains-stretched-to-the-breaking-point" rel="noopener">A developer panel reported by Bisnow</a>, Oct 2026.
          </p>

          <div className="split wanted" id="wanted">
            <div className="intro">
              <h2>{sample ? 'Example requests' : 'Wanted'}</h2>
              <p className="soft">
                {sample
                  ? 'What a builder posts: a spec, a site and the date they must energize. If you hold gear like this, tell us what you have, even if it is not an exact fit.'
                  : 'Builders with a utility date and no gear. If you hold something close to one of these, it is worth listing even if it is not an exact fit.'}
              </p>
              <Link href={sell} className="btn line">{u?.role === 'seller' ? 'List gear you hold' : 'I hold gear like this'}<Arrow /></Link>
            </div>
            <div className="scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Equipment</th><th className="wide-only">Minimum rating</th><th className="wide-only">Qty</th>
                    <th className="wide-only">Site</th><th>Need by</th>{!sample && <th><span className="vh">Action</span></th>}
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
                      {!sample && <td><Link href={sell}>Offer yours</Link></td>}
                    </tr>
                  ))}
                  {needs.length === 0 && <tr><td colSpan={6} className="empty">No open requests today.</td></tr>}
                </tbody>
              </table>
              {sample && <p className="board-note soft small">Samples, not live requests.</p>}
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
            {u?.role === 'buyer' ? <Link href="/requests/new" className="btn go">Post a need<Arrow /></Link>
              : u?.role === 'seller' ? <Link href="/listings/new" className="btn go">List gear<Arrow /></Link>
              : u ? <Link href="/admin" className="btn go">Open operations<Arrow /></Link>
              : <><Link href="/login?role=buyer" className="btn go">I need gear<Arrow /></Link><Link href="/login?role=seller" className="btn line">I hold gear</Link></>}
          </div>
          <p className="soft small">Free to list and to post a need. The buyer pays a success fee only when a deal closes.</p>
        </div>
      </section>
    </main>
  );
}
