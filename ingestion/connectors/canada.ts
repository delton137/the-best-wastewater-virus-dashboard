import type { Connector } from "./types";
import { canonicalize } from "./types";

// Canada Health Infobase — National Wastewater Monitoring (Open Government Licence).
// Current weekly viral-load feed includes historical site data and regional rollups.
// Select only collection sites to avoid counting city/province/national aggregates twice.
// Units: https://health-infobase.canada.ca/wastewater/technical-notes.html

const CSV =
  "https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv";

export const canada: Connector = {
  id: "canada_phac",
  selects(retrievedAt: string) {
    return [
      canonicalize(`
        SELECT
          'canada_phac'                              AS source_id,
          'canada_phac:' || site AS site_id,
          "Location"                                 AS site_name,
          'CA'                                       AS country,
          CASE CAST(pruid AS VARCHAR)
            WHEN '10' THEN 'Newfoundland and Labrador'
            WHEN '11' THEN 'Prince Edward Island'
            WHEN '12' THEN 'Nova Scotia'
            WHEN '13' THEN 'New Brunswick'
            WHEN '24' THEN 'Quebec'
            WHEN '35' THEN 'Ontario'
            WHEN '46' THEN 'Manitoba'
            WHEN '47' THEN 'Saskatchewan'
            WHEN '48' THEN 'Alberta'
            WHEN '59' THEN 'British Columbia'
            WHEN '60' THEN 'Yukon'
            WHEN '61' THEN 'Northwest Territories'
            WHEN '62' THEN 'Nunavut'
          END                                        AS admin1,
          city                                       AS admin2,
          NULL                                       AS lat,
          NULL                                       AS lon,
          NULL                                       AS population_served,
          CASE measureid WHEN 'covN2' THEN 'sars_cov_2'
            WHEN 'fluA' THEN 'influenza_a'
            WHEN 'fluB' THEN 'influenza_b'
            WHEN 'rsv' THEN 'rsv' END                   AS pathogen,
          weekstart                                  AS sample_date,
          w_avg                                      AS value_raw,
          'copies/mL (weekly average)'                AS unit_raw,
          'concentration'                            AS metric_type,
          false                                      AS flow_normalized,
          false                                      AS pmmov_normalized,
          '${CSV}'                                   AS provenance_url,
          TIMESTAMP '${retrievedAt}'                 AS retrieved_at
        FROM read_csv_auto('${CSV}', sample_size=2000, ignore_errors=true)
        WHERE measureid IN ('covN2', 'fluA', 'fluB', 'rsv')
          AND nullif(trim(site), '') IS NOT NULL
      `),
    ];
  },
};
