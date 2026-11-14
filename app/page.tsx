import Link from 'next/link';

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Stranded switchgear, matched to the builds that need it now.</h1>
        <p className="lead">
          New medium-voltage switchgear takes 52 to 104 weeks. Meanwhile, cancelled and delayed data center projects are sitting on
          new, never-energized gear. Gridstock privately matches that gear to builders by spec and need-by date, then runs the
          deal through NDA, inspection and escrow.
        </p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <Link href="/login?role=seller"><button>I have gear</button></Link>
          <Link href="/login?role=buyer"><button className="secondary">I need gear</button></Link>
        </div>
      </section>
      <div className="grid2" style={{ marginTop: 32 }}>
        <div className="card"><h2 style={{ marginTop: 0 }}>For owners of stranded gear</h2>
          <p className="muted">List privately. Your project name never appears, and only buyers we have verified see the specs. Recover capital in weeks instead of eating restocking fees.</p></div>
        <div className="card"><h2 style={{ marginTop: 0 }}>For builders on a deadline</h2>
          <p className="muted">Post the spec and the date you must energize. Get a ranked shortlist with a fit score and the exact gaps, such as an interrupting rating that needs a breaker swap.</p></div>
      </div>
    </>
  );
}
