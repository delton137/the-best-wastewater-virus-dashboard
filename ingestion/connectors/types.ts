// A connector turns one external source into canonical `Measurement` rows, expressed
// as SQL SELECT statement(s) evaluated by DuckDB (with httpfs). Each SELECT MUST emit
// exactly the columns in CANONICAL_COLUMNS, in order, with the casts below.

export interface Connector {
  /** Matches SourceManifest.id and Measurement.source_id. */
  id: string;
  /**
   * Build one or more SELECT statements producing canonical columns.
   * `retrievedAt` is an ISO timestamp string for provenance.
   */
  selects(retrievedAt: string): Promise<string[]> | string[];
}

/** Canonical column order. Every connector SELECT must match this exactly. */
export const CANONICAL_COLUMNS = [
  "source_id",
  "site_id",
  "site_name",
  "country",
  "admin1",
  "admin2",
  "lat",
  "lon",
  "population_served",
  "pathogen",
  "sample_date",
  "value_raw",
  "unit_raw",
  "metric_type",
  "flow_normalized",
  "pmmov_normalized",
  "provenance_url",
  "retrieved_at",
] as const;

/**
 * Wrap a connector's inner SELECT body (which must alias every canonical column)
 * in a projection that enforces the exact column order and types, so heterogeneous
 * connectors UNION ALL cleanly.
 */
export function canonicalize(innerSelect: string): string {
  return `SELECT
    CAST(source_id AS VARCHAR)        AS source_id,
    CAST(site_id AS VARCHAR)          AS site_id,
    CAST(site_name AS VARCHAR)        AS site_name,
    CAST(country AS VARCHAR)          AS country,
    CAST(admin1 AS VARCHAR)           AS admin1,
    CAST(admin2 AS VARCHAR)           AS admin2,
    CAST(lat AS DOUBLE)              AS lat,
    CAST(lon AS DOUBLE)              AS lon,
    CAST(population_served AS DOUBLE) AS population_served,
    CAST(pathogen AS VARCHAR)        AS pathogen,
    CAST(sample_date AS DATE)        AS sample_date,
    CAST(value_raw AS DOUBLE)        AS value_raw,
    CAST(unit_raw AS VARCHAR)        AS unit_raw,
    CAST(metric_type AS VARCHAR)     AS metric_type,
    CAST(flow_normalized AS BOOLEAN) AS flow_normalized,
    CAST(pmmov_normalized AS BOOLEAN) AS pmmov_normalized,
    CAST(provenance_url AS VARCHAR)  AS provenance_url,
    CAST(retrieved_at AS TIMESTAMP)  AS retrieved_at
  FROM (${innerSelect}) _c
  WHERE sample_date IS NOT NULL AND value_raw IS NOT NULL`;
}
