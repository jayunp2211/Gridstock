import { Pool } from 'pg';

const g = globalThis as unknown as { _pool?: Pool };
export const pool = g._pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hosted Postgres (Supabase pooler) needs TLS; local Postgres does not.
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '') ? undefined : { rejectUnauthorized: false },
  max: 3,
});
if (process.env.NODE_ENV !== 'production') g._pool = pool;

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
