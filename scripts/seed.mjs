// Loads the sample accounts and gear. All companies and people are fictional.
// Safe to rerun: it replaces sample data only and leaves every other account alone.
import pg from 'pg';
import { seedDemo } from '../lib/demo.ts';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('begin');
  const n = await seedDemo((text, params) => c.query(text, params).then(r => r.rows));
  await c.query('commit');
  console.log(`seeded ${n.users} users, ${n.listings} listings, ${n.requests} requests, ${n.matches} matches`);
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  await c.end();
}
