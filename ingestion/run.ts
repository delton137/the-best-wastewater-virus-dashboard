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
import { materializeParts } from "./lib/materialize";

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
    if (!parts.length) throw new Error(`${id} returned no datasets; publication aborted`);
    selects.push(...parts);
  }

  // Validate every requested part before replacing any published files.
  await materializeParts(conn, selects);
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
