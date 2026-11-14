import Link from 'next/link';
import { sendContact } from '@/app/actions';
import { FEE_PCT, NETA, OPERATOR } from '@/lib/site';
import { Arrow } from '@/components/ui';

export const metadata = {
  title: 'About Gridstock',
  description: 'Who runs Gridstock, what it does in a deal, what it leaves to the buyer and the seller, and how to reach it.',
};

// What Gridstock does in a deal and what it leaves to the two sides. The second half matters as much as the first:
// nobody should think the marketplace has inspected the equipment or is holding their money.
const ROLE: [string, React.ReactNode][] = [
  ['Matches by spec', 'Compares the nameplate ratings a seller lists with the spec a builder posts, and shows the fit with every gap. It is a first screen, and the documents settle the rest.'],
  ['Introduces under NDA', <>Keeps both names and the price hidden until both sides accept a mutual NDA with non-circumvention. <Link href="/nda">Read the agreement</Link>.</>],
  ['Keeps the record', 'Documents, offers, the inspection result and each escrow step sit in one room that only the two sides and Gridstock can open.'],
  ['Does not inspect', <>The buyer appoints an independent testing firm and decides what its report means. <a href={NETA.href} rel="noopener">{NETA.label}</a> accredits such firms and lists them.</>],
  ['Does not hold money', 'The price sits with a licensed escrow agent that both sides choose, and is released when the buyer confirms delivery. Gridstock never holds or moves it.'],
  ['Does not own the gear', 'The seller sells to the buyer under their own purchase agreement. Gridstock is not a party to it and gives no warranty on the equipment.'],
];

const ERRORS: Record<string, string> = {
  contact: 'Enter your name, an email address we can reply to, and a message of at least ten characters.',
  busy: 'The form is taking a rest because a lot of messages arrived at once. Try again in an hour.',
};

export default async function About({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <main className="about">
      <section className="frame hero">
        <h1>Who you are dealing with</h1>
        <div className="hero-foot">
          <p className="sub">
            Gridstock is a private market for new and never-energized electrical and cooling equipment that paused data center
            projects left behind. It matches that equipment to builders racing a utility date, and gives the two sides a private
            room to agree a sale.
          </p>
        </div>
      </section>

      <section className="frame section split" id="who">
        <div className="intro"><h2>Who runs it</h2></div>
        <div className="prose">
          {OPERATOR.name && (
            <p className="lead">
              Gridstock was founded and is run by {OPERATOR.name}.
              {OPERATOR.profile && <> <a href={OPERATOR.profile.href} rel="noopener me">{OPERATOR.name} on {OPERATOR.profile.label}</a>.</>}
            </p>
          )}
          <p>
            Gridstock is new. It is signing up its first sellers and builders, and every company is checked by hand before it
            can list equipment or post a need. The demo on this site runs on fictional companies and equipment.
          </p>
          <p>
            <a href="#contact">Write to us</a> with a question about a listing, a need, the agreement or the fee.
            {OPERATOR.name && ` Messages from this page go to ${OPERATOR.name.split(' ')[0]} directly.`}
          </p>
        </div>
      </section>

      <section className="frame section split" id="role">
        <div className="intro">
          <h2>What it does in a deal</h2>
          <p className="soft">And what it leaves to the buyer and the seller.</p>
        </div>
        <ol className="course">
          {ROLE.map(([name, text]) => <li key={name}><span className="stage">{name}</span><p>{text}</p></li>)}
        </ol>
      </section>

      <section className="frame section split" id="fee">
        <div className="intro"><h2>What it costs</h2></div>
        <div className="prose">
          <p className="lead">Listing equipment and posting a need are free. When a deal closes, the buyer pays Gridstock {FEE_PCT}% of the agreed price.</p>
          <p>The seller pays nothing. Nothing is owed on a deal that does not close.</p>
        </div>
      </section>

      <section className="frame section split" id="contact">
        <div className="intro">
          <h2>Write to us</h2>
          <p className="soft">You get a reply by email. Your details are used to answer you and for nothing else.</p>
        </div>
        <div>
          {sent && <div className="notice" role="status">Thanks. Your message is in, and we will reply by email.</div>}
          {error && <div className="notice" role="alert">{Object.hasOwn(ERRORS, error) ? ERRORS[error] : ERRORS.contact}</div>}
          <form action={sendContact} className="stack sheet">
            <div className="fields">
              <label>Name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
              <label>Email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
            </div>
            <label><span>Company <span className="hint">optional</span></span><input name="company" maxLength={120} autoComplete="organization" /></label>
            <label>Message<textarea name="body" required minLength={10} maxLength={4000} /></label>
            <label className="trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <div><button className="go">Send message<Arrow /></button></div>
          </form>
        </div>
      </section>
    </main>
  );
}
