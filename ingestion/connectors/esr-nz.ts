import type { Connector } from "./types";
import { canonicalize } from "./types";

// ESR New Zealand — national wastewater surveillance (GitHub CSV, open).
// Site-level series ww_site.csv (copies/person/day) joined to sites.csv metadata,
// which DOES include Latitude/Longitude — precise map points.

const BASE =
  "https://raw.githubusercontent.com/ESR-NZ/covid_in_wastewater/main/data";
const SITE = `${BASE}/ww_site.csv`;
const META = `${BASE}/sites.csv`;
const HOME = "https://github.com/ESR-NZ/covid_in_wastewater";

export const esrNz: Connector = {
  id: "esr_nz",
  selects(retrievedAt: string) {
    return [
      canonicalize(`
        SELECT
          'esr_nz'                                   AS source_id,
          'esr_nz:' || s."SampleLocation"            AS site_id,
          coalesce(m."DisplayName", s."SampleLocation") AS site_name,
          'NZ'                                       AS country,
          m."Region"                                 AS admin1,
          NULL                                       AS admin2,
          m."Latitude"                               AS lat,
          m."Longitude"                              AS lon,
          m."Population"                             AS population_served,
          'sars_cov_2'                               AS pathogen,
          s."week_end_date"                          AS sample_date,
          s.copies_per_day_per_person                AS value_raw,
          'copies/person/day'                        AS unit_raw,
          'copies_per_capita'                        AS metric_type,
          true                                       AS flow_normalized,
          false                                      AS pmmov_normalized,
          '${HOME}'                                  AS provenance_url,
          TIMESTAMP '${retrievedAt}'                 AS retrieved_at
        FROM read_csv_auto('${SITE}', sample_size=2000, ignore_errors=true) s
        LEFT JOIN read_csv_auto('${META}', sample_size=2000, ignore_errors=true) m
          ON s."SampleLocation" = m."SampleLocation"
      `),
    ];
  },
};
