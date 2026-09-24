// Unified data model for the wastewater dashboard.
// PHES-ODM-inspired. Every connector normalizes its source into `Measurement` rows.

/** Controlled pathogen vocabulary. Connectors MUST map source labels into one of these. */
export const PATHOGENS = [
  "sars_cov_2",
  "influenza_a",
  "influenza_b",
  "rsv",
  "mpox",
  "measles",
  "h5n1",
  "norovirus",
] as const;
export type Pathogen = (typeof PATHOGENS)[number];

/** Human-facing labels for the pathogen vocabulary. */
export const PATHOGEN_LABELS: Record<Pathogen, string> = {
  sars_cov_2: "SARS-CoV-2",
  influenza_a: "Influenza A",
  influenza_b: "Influenza B",
  rsv: "RSV",
  mpox: "Mpox",
  measles: "Measles",
  h5n1: "H5N1 avian flu",
  norovirus: "Norovirus",
};

/**
 * What kind of number `value_raw` is. Absolute concentrations are NOT comparable
 * across labs/sources; the dashboard's default comparable metric is the within-site
 * standardized trend (`value_norm`), computed during aggregation.
 */
export type MetricType =
  | "concentration" // gene copies per L / mL / g dry weight, flow- or PMMoV-normalized
  | "viral_activity_pct" // CDC-style percentile / "viral activity level"
  | "copies_per_capita"; // e.g. copies per person per day (NZ)

/** One normalized observation — the grain of the Parquet lake. */
export interface Measurement {
  source_id: string; // e.g. "cdc_nwss"
  site_id: string; // stable surrogate: `${source_id}:${native_site_id}`
  site_name: string | null;
  country: string; // ISO-3166 alpha-2, e.g. "US", "CA", "NZ"
  admin1: string | null; // state / province / region
  admin2: string | null; // county / district
  lat: number | null;
  lon: number | null;
  population_served: number | null;
  pathogen: Pathogen;
  sample_date: string; // ISO date (YYYY-MM-DD)
  value_raw: number | null;
  unit_raw: string | null; // as published, e.g. "copies/L", "copies/g dry weight"
  metric_type: MetricType;
  flow_normalized: boolean;
  pmmov_normalized: boolean;
  provenance_url: string; // dataset / file URL the value came from
  retrieved_at: string; // ISO timestamp of ingestion run
}

/** Ordered column list — used to build Parquet/relations consistently. */
export const MEASUREMENT_COLUMNS: (keyof Measurement)[] = [
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
];

export function isPathogen(x: string): x is Pathogen {
  return (PATHOGENS as readonly string[]).includes(x);
}
