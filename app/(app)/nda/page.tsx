import { agreement, NDA_DRAFT_NOTE, NDA_SUMMARY, NDA_VERSION } from '@/lib/nda';
import { AgreementText } from '@/components/agreement';

export const metadata = {
  title: { absolute: 'The Gridstock NDA' },
  description: 'The mutual NDA with non-circumvention that a buyer and a seller accept on Gridstock before names and prices are shown.',
  alternates: { canonical: '/nda' },
  robots: { index: true, follow: true },
};

/** The agreement behind the "Accept NDA" button, public so that anyone can read it before they join. */
export default async function Nda({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams;
  const a = agreement(version);
  return (
    <>
      <div className="head">
        <div>
          <h1>{a.title}</h1>
          <p>
            Both sides of a deal accept this before either learns who the other is.
            This is version {a.version}{a.version === NDA_VERSION ? ', the one a new deal accepts' : ''}.
          </p>
        </div>
      </div>
      <div className="notice" role="note">{NDA_DRAFT_NOTE}</div>
      <h2>In short</h2>
      <ul className="points">{NDA_SUMMARY.map(s => <li key={s}>{s}</li>)}</ul>
      <h2>The full text</h2>
      <AgreementText a={a} />
    </>
  );
}
