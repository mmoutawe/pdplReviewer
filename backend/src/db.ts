import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  host:     process.env.PGHOST     ?? 'db',
  port:     Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'pdplr',
  user:     process.env.PGUSER     ?? 'pdplr',
  password: process.env.PGPASSWORD ?? 'pdplr',
  max: 10,
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(sql, params)
  return result.rows
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
