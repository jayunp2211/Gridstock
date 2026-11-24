'use client';
import Link from 'next/link';

export default function Failed({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="app" id="main">
      <div className="head">
        <div>
          <h1>That did not work</h1>
          <p>Something went wrong on our side and nothing was saved. Try again, and if it keeps happening, go back and start the step over.</p>
        </div>
      </div>
      <div className="inline">
        <button onClick={reset}>Try again</button>
        <Link href="/" className="btn line">Back to the start</Link>
      </div>
    </main>
  );
}
