import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
import { query } from "./duck";
import { centroidsValuesSql } from "./centroids";

const ROOT = process.cwd();
const LAKE_DIR = path.join(ROOT, "data", "lake");
const AGG_DIR = path.join(ROOT, "public", "aggregates");

/** Write the partitioned Parquet lake from the `m` table (site-level grain). */
export async function writeLake(conn: DuckDBConnection): Promise<void> {
  await rm(LAKE_DIR, { recursive: true, force: true });
  await mkdir(LAKE_DIR, { recursive: true });
  await conn.run(
    `COPY (SELECT * FROM m) TO '${LAKE_DIR}'
       (FORMAT PARQUET, PARTITION_BY (pathogen, source_id), OVERWRITE_OR_IGNORE)`,
  );
}

/**
 * Compute within-site standardized values, then write the small JSON aggregates the
 * dashboard reads directly: region markers (map), trends (charts), coverage, meta.
 */
export async function writeAggregates(
  conn: DuckDBConnection,
  outputDir = AGG_DIR,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const writeJson = async (name: string, data: unknown) => {
    await writeFile(path.join(outputDir, name), JSON.stringify(data), "utf8");
  };

  // site_pct = within-site percentile of value_raw over that site's full history (0-100).
  // This is the cross-source comparable metric; absolute concentrations are not comparable.
  await conn.run(`
    CREATE OR REPLACE TABLE mp AS
    SELECT *,
      100.0 * percent_rank() OVER (
        PARTITION BY site_id, pathogen ORDER BY value_raw
      ) AS site_pct
    FROM m
  `);

  // Centroids: prefer coordinates derived from the data (sites that have lat/lon),
  // else fall back to the static state/province table.
  await conn.run(`
    CREATE OR REPLACE TABLE data_centroids AS
    SELECT country, admin1, avg(lat) AS lat, avg(lon) AS lon
    FROM m
    WHERE lat IS NOT NULL AND lon IS NOT NULL AND admin1 IS NOT NULL
    GROUP BY country, admin1
  `);
  await conn.run(`
    CREATE OR REPLACE TABLE centroids AS
    WITH static_c AS (SELECT * FROM ${centroidsValuesSql()})
    SELECT
      coalesce(d.country, s.country) AS country,
      coalesce(d.admin1, s.admin1)   AS admin1,
      coalesce(d.lat, s.lat)         AS lat,
      coalesce(d.lon, s.lon)         AS lon
    FROM data_centroids d
    FULL OUTER JOIN static_c s ON d.country = s.country AND d.admin1 = s.admin1
  `);

  // Region markers — latest 28-day window mean of site_pct per (country, admin1, pathogen).
  const regions = await query(
    conn,
    `
    WITH latest AS (
      SELECT country, admin1, pathogen, max(sample_date) AS maxd FROM mp
      WHERE admin1 IS NOT NULL GROUP BY 1,2,3
    ),
    site_window AS (
      SELECT mp.country, mp.admin1, mp.pathogen, mp.site_id, mp.source_id,
             avg(mp.site_pct) AS site_value,
             max(mp.sample_date) AS latest_date
      FROM mp JOIN latest l
        ON mp.country=l.country AND mp.admin1=l.admin1 AND mp.pathogen=l.pathogen
       AND mp.sample_date >= l.maxd - INTERVAL 28 DAY
      GROUP BY 1,2,3,4,5
    ),
    win AS (
      SELECT country, admin1, pathogen,
             round(avg(site_value), 1) AS value,
             count(DISTINCT site_id) AS n_sites,
             strftime(max(latest_date), '%Y-%m-%d') AS latest_date,
             list(DISTINCT source_id) AS sources
      FROM site_window GROUP BY 1,2,3
    )
    SELECT w.*, c.lat, c.lon
    FROM win w LEFT JOIN centroids c
      ON w.country=c.country AND w.admin1=c.admin1
    WHERE c.lat IS NOT NULL
    ORDER BY w.country, w.admin1, w.pathogen
  `,
  );

  // Trends — weekly mean site_pct per (country, admin1, pathogen) plus national (ALL).
  const trendRows = await query<{
    country: string;
    admin1: string;
    pathogen: string;
    week: string;
    value: number;
  }>(
    conn,
    `
    WITH site_week AS (
      SELECT country, admin1, pathogen, site_id,
             strftime(date_trunc('week', sample_date), '%Y-%m-%d') AS week,
             avg(site_pct) AS site_value
      FROM mp GROUP BY 1,2,3,4,5
    )
    SELECT country, admin1, pathogen, week, value FROM (
      SELECT country, admin1, pathogen,
             week, round(avg(site_value),1) AS value
      FROM site_week WHERE admin1 IS NOT NULL GROUP BY 1,2,3,4
      UNION ALL
      SELECT country, 'ALL' AS admin1, pathogen,
             week, round(avg(site_value),1) AS value
      FROM site_week GROUP BY 1,2,3,4
    ) ORDER BY country, admin1, pathogen, week
  `,
  );
  const trends: Record<string, [string, number][]> = {};
  for (const r of trendRows) {
    const key = `${r.country}__${r.admin1}__${r.pathogen}`;
    (trends[key] ??= []).push([r.week, r.value]);
  }

  // Trends in source units — same grain as trends, but y = weekly median across sites of
  // each site's weekly median value_raw (as in seasonal), so values keep the source's units.
  // Units differ by source, so they are only comparable within a country.
  const unitRows = await query<{
    country: string;
    admin1: string;
    pathogen: string;
    week: string;
    value: number;
    unit: string;
  }>(
    conn,
    `
    WITH site_week AS (
      SELECT country, admin1, pathogen, site_id,
             strftime(date_trunc('week', sample_date), '%Y-%m-%d') AS week,
             median(value_raw) AS site_val,
             any_value(unit_raw) AS unit
      FROM m GROUP BY 1,2,3,4,5
    )
    SELECT country, admin1, pathogen, week, value, unit FROM (
      SELECT country, admin1, pathogen, week,
             median(site_val) AS value, any_value(unit) AS unit
      FROM site_week WHERE admin1 IS NOT NULL GROUP BY 1,2,3,4
      UNION ALL
      SELECT country, 'ALL' AS admin1, pathogen, week,
             median(site_val) AS value, any_value(unit) AS unit
      FROM site_week GROUP BY 1,2,3,4
    ) ORDER BY country, admin1, pathogen, week
  `,
  );
  const trendsUnits: {
    units: Record<string, string>; // `${country}__${pathogen}` → unit
    series: Record<string, [string, number][]>;
  } = { units: {}, series: {} };
  for (const r of unitRows) {
    const key = `${r.country}__${r.admin1}__${r.pathogen}`;
    // 4 significant digits keeps the file small without flattening small concentrations.
    (trendsUnits.series[key] ??= []).push([r.week, Number(r.value.toPrecision(4))]);
    trendsUnits.units[`${r.country}__${r.pathogen}`] ??= r.unit;
  }

  // Coverage — per-source stats for the transparency page.
  const coverage = await query(
    conn,
    `
    SELECT source_id,
           count(*) AS rows,
           strftime(min(sample_date), '%Y-%m-%d') AS min_date,
           strftime(max(sample_date), '%Y-%m-%d') AS max_date,
           count(DISTINCT site_id) AS n_sites,
           list(DISTINCT pathogen) AS pathogens,
           list(DISTINCT provenance_url) AS provenance_urls,
           list(DISTINCT unit_raw) AS units,
           max(retrieved_at)::VARCHAR AS retrieved_at
    FROM m GROUP BY source_id ORDER BY source_id
  `,
  );

  const meta = await query(
    conn,
    `SELECT
       (SELECT count(*) FROM m) AS total_rows,
       (SELECT list(DISTINCT pathogen) FROM m) AS pathogens,
       (SELECT list(DISTINCT country) FROM m) AS countries`,
  );

  // Seasonal — one line per calendar year, y = median measured value in the source's own
  // (objective) units, x = fractional month so years overlay with month ticks aligned.
  //
  // Aggregated WEEKLY-PER-SITE to avoid a compositional artifact: sites sample on fixed
  // weekdays, so the set reporting on any given calendar day swings ~10x (and sites differ
  // by orders of magnitude), making a raw per-day median oscillate with a 7-day period.
  // We first collapse each site to one value per ISO week, then take the median across
  // sites that week — every active site contributes once, so the panel is stable.
  const seasonalRows = await query<{
    country: string;
    pathogen: string;
    y: number;
    x: number;
    val: number;
    unit: string;
    n_sites: number;
  }>(
    conn,
    `
    WITH site_week AS (
      SELECT country, pathogen, site_id,
             date_trunc('week', sample_date) AS wk,   -- Monday of the ISO week
             median(value_raw)  AS site_val,
             any_value(unit_raw) AS unit
      FROM m
      GROUP BY country, pathogen, site_id, date_trunc('week', sample_date)
    )
    SELECT country, pathogen,
           year(wk + INTERVAL 3 DAY) AS y,            -- assign week by its Thursday
           round(month(wk + INTERVAL 3 DAY)
                 + (day(wk + INTERVAL 3 DAY) - 1.0)
                   / day(last_day(wk + INTERVAL 3 DAY)), 4) AS x,
           median(site_val)          AS val,
           any_value(unit)           AS unit,
           count(DISTINCT site_id)   AS n_sites
    FROM site_week
    GROUP BY country, pathogen, wk
    ORDER BY country, pathogen, y, x
  `,
  );
  type SeasonalEntry = {
    unit: string;
    sources: string[];
    provenance_urls: string[];
    years: Record<string, [number, number, number][]>; // [fractionalMonth, value, n_sites]
  };
  const seasonal: Record<string, Record<string, SeasonalEntry>> = {};
  for (const r of seasonalRows) {
    const byPathogen = (seasonal[r.country] ??= {});
    const entry = (byPathogen[r.pathogen] ??= {
      unit: r.unit,
      sources: [],
      provenance_urls: [],
      years: {},
    });
    (entry.years[String(r.y)] ??= []).push([r.x, r.val, r.n_sites]);
  }
  // Attach provenance (contributing sources + dataset URLs) per country+pathogen.
  const provRows = await query<{
    country: string;
    pathogen: string;
    sources: string[];
    provenance_urls: string[];
  }>(
    conn,
    `SELECT country, pathogen,
            list(DISTINCT source_id)      AS sources,
            list(DISTINCT provenance_url) AS provenance_urls
     FROM m GROUP BY 1,2`,
  );
  for (const r of provRows) {
    const entry = seasonal[r.country]?.[r.pathogen];
    if (entry) {
      entry.sources = r.sources;
      entry.provenance_urls = r.provenance_urls;
    }
  }

  await writeJson("regions.json", regions);
  await writeJson("trends.json", trends);
  await writeJson("trends_units.json", trendsUnits);
  await writeJson("seasonal.json", seasonal);
  await writeJson("coverage.json", coverage);
  await writeJson("meta.json", {
    ...meta[0],
    generated_at: new Date().toISOString(),
  });

  console.log(
    `aggregates: ${regions.length} region markers, ${Object.keys(trends).length} trend series, ${coverage.length} sources`,
  );
}
