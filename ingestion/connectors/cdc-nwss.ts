import type { Connector } from "./types";
import { canonicalize } from "./types";
import { usStateCodeSql } from "../lib/centroids";

// CDC National Wastewater Surveillance System (Socrata, public domain).
// CDC's modern per-pathogen datasets share one per-sample schema, so a single builder
// serves every pathogen. We use these (not the legacy g653/2ew6 "public metric" datasets,
// which CDC froze in Sept 2025) — they run 2020→present and stay current.
//   SARS-CoV-2: j9g8-acpt   Influenza A: ymmh-divb   (Measles akvg-8vrb, Mpox xpxn-rzgz)
// CDC does not publish site lat/lon; placement uses state centroids downstream.

const LIM = process.env.CDC_LIMIT ? Number(process.env.CDC_LIMIT) : 5_000_000;

interface Target {
  dataset: string; // Socrata 4x4 id
  pcrTarget: string; // value of the pcr_target column
  pathogen: string; // our controlled vocab
}

// We keep only pcr_target_flowpop_lin (flow- and population-normalized) so units are
// uniform and comparable across sites/time — the metric CDC features nationally.
function perSampleSelect(t: Target, retrievedAt: string): string {
  const url = `https://data.cdc.gov/resource/${t.dataset}.csv?$limit=${LIM}`;
  return canonicalize(`
    SELECT
      'cdc_nwss'                                        AS source_id,
      'cdc_nwss:' || site                               AS site_id,
      site                                              AS site_name,
      'US'                                              AS country,
      ${usStateCodeSql("state_territory")}              AS admin1,
      counties_served                                   AS admin2,
      NULL                                              AS lat,
      NULL                                              AS lon,
      population_served                                 AS population_served,
      '${t.pathogen}'                                   AS pathogen,
      sample_collect_date                               AS sample_date,
      pcr_target_flowpop_lin                            AS value_raw,
      'copies/person/day (flow-population normalized)'  AS unit_raw,
      'concentration'                                   AS metric_type,
      true                                              AS flow_normalized,
      false                                             AS pmmov_normalized,
      'https://data.cdc.gov/d/${t.dataset}'             AS provenance_url,
      TIMESTAMP '${retrievedAt}'                        AS retrieved_at
    FROM read_csv_auto('${url}', sample_size=2000, ignore_errors=true)
    WHERE pcr_target = '${t.pcrTarget}'
      AND site IS NOT NULL
      AND pcr_target_flowpop_lin IS NOT NULL
  `);
}

const TARGETS: Target[] = [
  { dataset: "j9g8-acpt", pcrTarget: "sars-cov-2", pathogen: "sars_cov_2" },
  { dataset: "ymmh-divb", pcrTarget: "fluav", pathogen: "influenza_a" },
];

export const cdcNwss: Connector = {
  id: "cdc_nwss",
  selects(retrievedAt: string) {
    return TARGETS.map((t) => perSampleSelect(t, retrievedAt));
  },
};
