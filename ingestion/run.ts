// Ingestion orchestrator. Runs connectors, builds the unified `m` table, writes the
// Parquet lake + JSON aggregates. Runs in GitHub Actions (or locally).
//
//   npm run ingest -- --all            # all connectors
//   npm run ingest -- cdc_nwss esr_nz  # selected connectors
//   CDC_LIMIT=20000 npm run ingest -- --all   # cap CDC rows for fast dev runs

import { getConnection, query } from "./lib/duck";
import { CONNECTORS, CONNECTOR_BY_ID } from "./connectors/index";
import { writeLake, writeAggregates } from "./lib/writers";
import { syncLakeToR2 } from "./lib/r2";

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all") || args.length === 0;
  const ids = all ? CONNECTORS.map((c) => c.id) : args;

  const retrievedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const conn = await getConnection();

  const selects: string[] = [];
  for (const id of ids) {
    const connector = CONNECTOR_BY_ID[id];
    if (!connector) {
      console.error(`unknown connector: ${id}`);
      process.exit(1);
    }
    console.log(`→ ${id}`);
    const parts = await connector.selects(retrievedAt);
    selects.push(...parts);
  }

  // Materialize each connector select independently so one bad source can't abort the
  // whole run, then union the survivors into `m`.
  const ok: string[] = [];
  for (let i = 0; i < selects.length; i++) {
    const tbl = `part_${i}`;
    try {
      await conn.run(`CREATE OR REPLACE TABLE ${tbl} AS ${selects[i]}`);
      const [{ n }] = await query<{ n: number }>(
        conn,
        `SELECT count(*) n FROM ${tbl}`,
      );
      console.log(`  part_${i}: ${n} rows`);
      if (n > 0) ok.push(`SELECT * FROM ${tbl}`);
    } catch (e) {
      console.error(`  part_${i} FAILED:`, String((e as Error).message).slice(0, 300));
    }
  }
  if (ok.length === 0) {
    console.error("no data ingested; aborting");
    process.exit(1);
  }

  await conn.run(`CREATE OR REPLACE TABLE m AS ${ok.join("\nUNION ALL\n")}`);
  const [{ total }] = await query<{ total: number }>(
    conn,
    `SELECT count(*) total FROM m`,
  );
  console.log(`unified m: ${total} rows`);

  await writeLake(conn);
  await writeAggregates(conn);
  await syncLakeToR2();
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
