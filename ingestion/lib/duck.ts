import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

let instancePromise: Promise<DuckDBInstance> | null = null;

/** Shared in-memory DuckDB instance with httpfs loaded (for remote CSV/Socrata reads). */
export async function getConnection(): Promise<DuckDBConnection> {
  if (!instancePromise) {
    instancePromise = DuckDBInstance.create(":memory:");
  }
  const instance = await instancePromise;
  const conn = await instance.connect();
  await conn.run("INSTALL httpfs; LOAD httpfs;");
  // Be patient with slow government endpoints.
  await conn.run("SET http_timeout = 120000;");
  return conn;
}

/** Run a query and return plain JS row objects with BigInt coerced to Number. */
export async function query<T = Record<string, unknown>>(
  conn: DuckDBConnection,
  sql: string,
): Promise<T[]> {
  const reader = await conn.run(sql);
  const rows = await reader.getRowObjects();
  return rows.map(coerce) as T[];
}

function coerce(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = coerceValue(v);
  return out;
}

function coerceValue(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (Array.isArray(v)) return v.map(coerceValue);
  // DuckDB LIST values arrive as { items: [...] }; flatten to a plain array.
  if (v && typeof v === "object" && "items" in (v as Record<string, unknown>)) {
    const items = (v as { items: unknown }).items;
    if (Array.isArray(items)) return items.map(coerceValue);
  }
  return v;
}
