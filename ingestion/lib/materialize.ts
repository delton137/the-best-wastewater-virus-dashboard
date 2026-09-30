import type { DuckDBConnection } from "@duckdb/node-api";
import { query } from "./duck";

/** Fail before publication if any requested dataset fails or unexpectedly has no rows. */
export async function materializeParts(conn: DuckDBConnection, selects: string[]): Promise<void> {
  if (!selects.length) throw new Error("No datasets requested; publication aborted");
  const parts: string[] = [];
  for (const [i, select] of selects.entries()) {
    const table = `part_${i}`;
    try {
      await conn.run(`CREATE OR REPLACE TABLE ${table} AS ${select}`);
      const [{ n }] = await query<{ n: number }>(conn, `SELECT count(*) n FROM ${table}`);
      if (!n) throw new Error("dataset returned zero rows");
      console.log(`  ${table}: ${n} rows`);
      parts.push(`SELECT * FROM ${table}`);
    } catch (error) {
      throw new Error(`Dataset ${i + 1} failed; publication aborted and existing files retained`, { cause: error });
    }
  }
  await conn.run(`CREATE OR REPLACE TABLE m AS ${parts.join(" UNION ALL ")}`);
}
