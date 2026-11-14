import type { Agreement } from '@/lib/nda';

/** The text of an agreement, with its clauses numbered in order, since they refer to each other by number. */
export function AgreementText({ a }: { a: Agreement }) {
  return (
    <div className="agreement">
      {a.preamble.map(p => <p key={p}>{p}</p>)}
      <ol className="clauses">
        {a.clauses.map((c, i) => (
          <li key={c.title}>
            <h3>{i + 1}. {c.title}</h3>
            {c.body.map(p => <p key={p}>{p}</p>)}
          </li>
        ))}
      </ol>
    </div>
  );
}
