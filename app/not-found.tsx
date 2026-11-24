import Link from 'next/link';
import { Arrow } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="app" id="main">
      <div className="head">
        <div>
          <h1>Nothing here</h1>
          <p>That page does not exist, or it belongs to another account.</p>
        </div>
      </div>
      <Link href="/" className="btn line">Back to the start<Arrow /></Link>
    </main>
  );
}
