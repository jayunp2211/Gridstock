import Link from 'next/link';
import { Specs } from '@/components/ui';

const STEPS: [string, string, string][] = [
  ['01', 'List or post', 'Owners enter nameplate specs. Builders post the spec they need and the date they must energize.'],
  ['02', 'Match by spec', 'Voltage, amperage, interrupting rating and condition are checked. You get a fit score and the exact gaps.'],
  ['03', 'Meet under NDA', 'Names and pricing stay hidden until both sides sign. Then documents, test reports and offers move in one room.'],
  ['04', 'Inspect and close', 'An independent testing firm checks the gear before funds leave escrow and it ships to site.'],
];

const CATS: [string, string][] = [
  ['LV and MV switchgear', '480 V to 38 kV'],
  ['Switchboards', 'UL 891'],
  ['Circuit breakers', 'Power and molded case'],
  ['Transformers', 'Pad-mount and substation'],
  ['UPS systems', '500 kVA and up'],
  ['Coolant distribution units', 'Liquid to liquid'],
  ['Chillers', 'Air and water cooled'],
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">Private marketplace · Power and cooling</span>
            <h1>The gear you need is <em>already built.</em></h1>
            <p className="lead">
              New switchgear takes one to two years. Cancelled and delayed data center projects are sitting on crated,
              never-energized equipment. Gridstock matches it to your spec and your energization date.
            </p>
            <div className="cta">
              <Link href="/login?role=buyer" className="btn primary lg">Find gear for my build</Link>
              <Link href="/login?role=seller" className="btn on-dark lg">List stranded gear</Link>
            </div>
            <p className="hero-note">Free to list. Confidential until NDA.</p>
          </div>

          <div className="demo" aria-label="Example of a match">
            <div className="demo-head"><span>Example match</span><span>Need by 2027-02-15</span></div>
            <div className="row top-align" style={{ flexWrap: 'nowrap' }}>
              <div className="score-wrap">
                <div className="score" style={{ ['--p' as string]: 92 }}><span>92</span><small>fit</small></div>
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title">4000 A switchgear lineup</div>
                <Specs x={{ voltage_v: 480, amps: 4000, kaic: 65, enclosure: 'NEMA 1' }} extra={[['Cond', 'New, in crate']]} />
              </div>
            </div>
            <ul className="gaps">
              <li className="info">Available 76 days before your need-by date</li>
              <li className="info">Meets 65 kAIC interrupting rating</li>
              <li className="info">Ships from the same state as your site</li>
              <li className="warn">OEM warranty transfer to be confirmed</li>
            </ul>
            <div className="demo-foot">
              <span className="lock">Seller and price hidden until NDA</span>
              <span className="btn primary" aria-hidden="true">Request intro</span>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="fact"><div className="n">52–104<small>weeks</small></div><p>Lead time for new medium-voltage switchgear, up from about 24 before 2020.</p></div>
          <div className="fact"><div className="n">125<small>weeks</small></div><p>Lead time for high-voltage circuit breakers, up from 77 in 2023.</p></div>
          <div className="fact"><div className="n">~50%</div><p>Share of US data center builds planned for 2026 projected to be delayed or cancelled.</p></div>
        </div>
        <div className="wrap"><p className="sources" style={{ paddingBottom: 16, margin: 0 }}>Sources: IndustrialSage (Sep 2026), Wood Mackenzie via Reuters (Jul 2026), Bloomberg (Apr 2026).</p></div>
      </section>

      <div className="wrap">
        <section className="section">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>From stranded crate to energized site in four steps.</h2>
          </div>
          <div className="steps">
            {STEPS.map(([n, t, d]) => <div key={n}><span className="n">{n}</span><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </section>

        <section className="section">
          <div className="sides">
            <div className="side dark">
              <span className="eyebrow">For builders on a deadline</span>
              <h3>Pull your energization date back in.</h3>
              <p>Post one spec and see every unit that fits, ranked, with the gaps spelled out before you spend a call on it.</p>
              <ul>
                <li>Hard filters on voltage, amperage and condition</li>
                <li>Gaps flagged up front, such as a breaker swap to reach 65 kAIC</li>
                <li>Alerts the moment matching gear is listed</li>
              </ul>
              <div><Link href="/login?role=buyer" className="btn primary">Post a need</Link></div>
            </div>
            <div className="side">
              <span className="eyebrow">For owners of stranded gear</span>
              <h3>Recover capital without announcing a cancelled project.</h3>
              <p>List privately. Buyers see specs only, never your company or project name, until you both sign.</p>
              <ul>
                <li>Free to list, with no public catalog</li>
                <li>Matched only to builders whose spec fits</li>
                <li>Inspection and escrow handled for you</li>
              </ul>
              <div><Link href="/login?role=seller" className="btn">List gear</Link></div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <span className="eyebrow">What trades here</span>
            <h2>Electrical and cooling equipment for 5 to 100 MW builds.</h2>
          </div>
          <div className="cats">{CATS.map(([n, d]) => <span key={n} className="cat">{n}<i>{d}</i></span>)}</div>
        </section>

        <section className="closing">
          <h2>Holding gear from a paused project, or racing a utility date?</h2>
          <div className="cta" style={{ margin: 0 }}>
            <Link href="/login?role=seller" className="btn lg">List gear</Link>
            <Link href="/login?role=buyer" className="btn lg">Post a need</Link>
          </div>
        </section>
      </div>
    </>
  );
}
