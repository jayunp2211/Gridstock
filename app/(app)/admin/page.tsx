import Link from 'next/link';
import { q } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { STAGE_LABEL, money } from '@/lib/labels';
import { resetDemo, verifyUser } from '@/app/actions';
import { Spec, cat, day } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Admin({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  await requireUser('admin');
  const { reset } = await searchParams;
  const [counts] = await q<{ listings: number; requests: number; matches: number; deals: number; closed_value: number | null; waiting: number; messages: number }>(
    `select (select count(*)::int from listings where status = 'active') as listings,
            (select count(*)::int from requests where status = 'open') as requests,
            (select count(*)::int from matches m join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
              where l.status = 'active' and r.status = 'open') as matches,
            (select count(*)::int from deals where stage not in ('closed','lost')) as deals,
            (select sum(offer_price)::bigint from deals where stage = 'closed') as closed_value,
            (select count(*)::int from users where email not like '%.test' and not verified) as waiting,
            (select count(*)::int from contact_messages) as messages`);
  const deals = await q<{ id: string; stage: string; offer_price: number | null; oem: string; category: string; buyer: string; seller: string; updated_at: string }>(
    `select d.id, d.stage, d.offer_price, l.oem, l.category, b.company as buyer, s.company as seller, d.updated_at
     from deals d join matches m on m.id = d.match_id join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
     join users b on b.id = r.buyer_id join users s on s.id = l.seller_id order by (d.stage = 'lost'), d.updated_at desc`);
  const reqs = await q<{ id: string; category: string; voltage_v: number; secondary_v: number | null; amps_min: number | null; capacity_min: number | null; kaic_min: number | null; enclosure: string | null; need_by: string; company: string; matches: number; best: number | null }>(
    `select r.id, r.category, r.voltage_v, r.secondary_v, r.amps_min, r.capacity_min, r.kaic_min, r.enclosure, r.need_by, u.company,
            (select count(*)::int from matches m join listings l on l.id = m.listing_id where m.request_id = r.id and l.status = 'active') as matches,
            (select max(m.score) from matches m join listings l on l.id = m.listing_id where m.request_id = r.id and l.status = 'active') as best
     from requests r join users u on u.id = r.buyer_id where r.status = 'open' order by r.need_by`);
  // This account is open to every visitor of the demo, so it lists sample accounts only.
  // Real access requests are counted here and read in the database, never shown on this page.
  const users = await q<{ id: string; name: string; company: string; role: string; email: string }>(
    `select id, name, company, role, email from users where verified = false and role <> 'admin' and email like '%.test' order by created_at`);
  const figures: [string, number | string][] = [
    ['Active listings', counts.listings], ['Open requests', counts.requests], ['Matches', counts.matches],
    ['Open deals', counts.deals], ['Closed value', counts.closed_value == null ? '$0' : money(counts.closed_value)],
  ];
  return (
    <>
      <div className="head">
        <div>
          <h1>Operations</h1>
          <p>Both sides of the market, soonest deadlines first.</p>
        </div>
      </div>
      {reset && <div className="notice" role="status">The demo is back to its starting data.</div>}
      <dl className="figures">
        {figures.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>

      <h2>Deals</h2>
      <div className="scroll">
        <table className="data">
          <thead><tr><th>Equipment</th><th>Buyer</th><th>Seller</th><th>Stage</th><th>Offer</th><th>Updated</th></tr></thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.id}>
                <td className="lead-cell"><Link href={`/deals/${d.id}`}>{d.oem}</Link><div className="under">{cat(d.category)}</div></td>
                <td>{d.buyer}</td><td>{d.seller}</td><td>{STAGE_LABEL[d.stage]}</td>
                <td className="num">{d.offer_price == null ? <span className="soft">None yet</span> : money(d.offer_price)}</td>
                <td className="num">{day(d.updated_at)}</td>
              </tr>
            ))}
            {deals.length === 0 && <tr><td colSpan={6} className="empty">No deals yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Open requests by need-by date</h2>
      <div className="scroll">
        <table className="data">
          <thead><tr><th>Need by</th><th>Buyer</th><th>Equipment</th><th>Minimum rating</th><th>Matches</th><th>Best fit</th></tr></thead>
          <tbody>
            {reqs.map(r => (
              <tr key={r.id}>
                <td className="num lead-cell">{day(r.need_by)}</td><td>{r.company}</td><td>{cat(r.category)}</td>
                <td><Spec x={r} plain /></td><td className="num">{r.matches}</td>
                <td className="num">{r.best ?? <span className="soft">None</span>}</td>
              </tr>
            ))}
            {reqs.length === 0 && <tr><td colSpan={6} className="empty">No open requests.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Accounts to verify</h2>
      <p className="lede soft">
        {counts.waiting === 0 ? 'No company has asked for access yet.' : `${counts.waiting} ${counts.waiting === 1 ? 'company has' : 'companies have'} asked for access.`}{' '}
        Their names and email addresses are kept out of the demo. Read them in the database until email sign-in is in place.
      </p>
      <p className="lede soft">
        {counts.messages === 0 ? 'No message has come in through the contact form yet.' : `${counts.messages} ${counts.messages === 1 ? 'message has' : 'messages have'} come in through the contact form on the about page.`}{' '}
        They are kept out of the demo too. Read them in the contact_messages table.
      </p>
      <div className="scroll">
        <table className="data">
          <thead><tr><th>Sample account</th><th>Company</th><th>Role</th><th>Email</th><th><span className="vh">Action</span></th></tr></thead>
          <tbody>
            {users.map(x => (
              <tr key={x.id}>
                <td className="lead-cell">{x.name}</td><td>{x.company}</td><td>{x.role === 'buyer' ? 'Buyer' : 'Seller'}</td><td>{x.email}</td>
                <td><form action={verifyUser}><input type="hidden" name="user_id" value={x.id} /><button className="sm">Verify</button></form></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="empty">Every sample account is verified.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="panel ops">
        <h3>Reset the demo</h3>
        <p className="soft">Puts the sample companies, listings and requests back to their starting state, with fresh dates. Deals, offers, messages and documents made in the demo are cleared. Real accounts are not touched.</p>
        <form action={resetDemo}><button className="line">Reset demo data</button></form>
      </section>
    </>
  );
}
