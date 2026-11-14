import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (const f of readdirSync('db').filter(f => f.endsWith('.sql')).sort()) {
  await client.query(readFileSync(`db/${f}`, 'utf8'));
  console.log('applied', f);
}
await client.end();
