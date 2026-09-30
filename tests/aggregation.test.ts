import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { writeAggregates } from "../ingestion/lib/writers";
import { materializeParts } from "../ingestion/lib/materialize";
import { query } from "../ingestion/lib/duck";
import type { RegionMarker, Seasonal, Trends, TrendsUnits } from "../app/lib/aggregates";

// A has three high readings in the target week; B has one low reading.
// Their within-history ranks average to 2/3 and 0, respectively.
const fixture = `SELECT 'test' AS source_id, site_id, 'CA' AS country,
  'Ontario' AS admin1, 'influenza_a' AS pathogen, sample_date::DATE AS sample_date,
  value_raw::DOUBLE AS value_raw, 'copies/mL' AS unit_raw, NULL::DOUBLE AS lat, NULL::DOUBLE AS lon,
  'https://example.test/data' AS provenance_url, TIMESTAMP '2026-01-10' AS retrieved_at
  FROM (VALUES
    ('A', '2025-01-01', 0.001), ('A', '2026-01-05', 0.1),
    ('A', '2026-01-06', 0.2), ('A', '2026-01-07', 0.3),
    ('B', '2025-01-01', 0.9), ('B', '2026-01-05', 0.02)
  ) t(site_id, sample_date, value_raw)`;

test("aggregates retain decimals and weight sites equally despite unequal sampling", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "wastewater-test-"));
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    await materializeParts(conn, [fixture]);
    await writeAggregates(conn, output);
    const read = async (name: string) => JSON.parse(await readFile(path.join(output, name), "utf8"));
    const seasonal: Seasonal = await read("seasonal.json");
    assert.ok(Math.abs(seasonal.CA.influenza_a.years["2026"][0][1] - 0.11) < 1e-12);
    const trends: Trends = await read("trends.json");
    for (const key of ["CA__Ontario__influenza_a", "CA__ALL__influenza_a"]) {
      assert.equal(trends[key].find(([week]) => week === "2026-01-05")?.[1], 33.3);
    }
    // Source units: site medians (A: 0.2, B: 0.02) → median across sites 0.11 copies/mL.
    const trendsUnits: TrendsUnits = await read("trends_units.json");
    assert.equal(trendsUnits.units.CA__influenza_a, "copies/mL");
    for (const key of ["CA__Ontario__influenza_a", "CA__ALL__influenza_a"]) {
      assert.equal(trendsUnits.series[key].find(([week]) => week === "2026-01-05")?.[1], 0.11);
    }
    const regions: RegionMarker[] = await read("regions.json");
    assert.equal(regions[0].value, 33.3);
    assert.equal(regions[0].n_sites, 2);
    assert.equal(regions[0].latest_date, "2026-01-07");
    assert.deepEqual(regions[0].sources, ["test"]);
  } finally {
    conn.close();
    await rm(output, { recursive: true, force: true });
  }
});

for (const [name, badPart] of [
  ["SQL failure", "SELECT * FROM missing_source"],
  ["empty dataset", "SELECT 1 AS value WHERE false"],
]) {
  test(`${name} after a successful part leaves the previous unified data intact`, async () => {
    const instance = await DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    try {
      await conn.run("CREATE TABLE m AS SELECT 42 AS retained_value");
      await assert.rejects(materializeParts(conn, [fixture, badPart]), /publication aborted/);
      assert.deepEqual(await query(conn, "SELECT * FROM m"), [{ retained_value: 42 }]);
      await assert.rejects(materializeParts(conn, []), /publication aborted/);
    } finally {
      conn.close();
    }
  });
}
