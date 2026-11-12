import postgres from "postgres";

/**
 * Postgres 接続（Supabase の DB に直接つなぐ）。
 * ローカル：`supabase start` 後の DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
 * 本番：Supabase の Connection pooler（transaction mode）URL。prepare:false はそのため。
 *
 * DATABASE_URL が無いときは null を返し、読み取りは空、書き込みはエラーにする
 * （DB なしでもビルド・閲覧はできるように）。
 */
export type Sql = postgres.Sql;

const g = globalThis as unknown as { __xmallSql?: Sql | null };

export function getSql(): Sql | null {
  if (g.__xmallSql !== undefined) return g.__xmallSql;
  const url = process.env.DATABASE_URL;
  g.__xmallSql = url ? postgres(url, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 5 }) : null;
  return g.__xmallSql;
}

export class DbUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL が設定されていません");
  }
}

export function requireSql(): Sql {
  const sql = getSql();
  if (!sql) throw new DbUnavailableError();
  return sql;
}
