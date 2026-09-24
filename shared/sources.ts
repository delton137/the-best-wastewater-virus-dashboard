// Source registry. Drives the ingestion matrix AND the live coverage page.
// Keep this in sync with the connectors in ingestion/connectors/.

import type { Pathogen } from "./schema";

export type AccessKind = "socrata" | "csv" | "github" | "api" | "dashboard";
export type Tier = "A" | "B" | "C" | "D";

export interface SourceManifest {
  id: string; // matches Measurement.source_id and the connector filename
  name: string;
  country: string; // ISO alpha-2, or "EU"/"GLOBAL"
  region_label: string; // human description of coverage
  pathogens: Pathogen[]; // what we currently ingest from this source
  earliest: string; // earliest data date we expect (YYYY-MM or YYYY-MM-DD)
  access: AccessKind;
  license: string;
  homepage: string;
  tier: Tier;
  /** False until a connector exists; the coverage page shows these as "planned". */
  implemented: boolean;
}

export const SOURCES: SourceManifest[] = [
  {
    id: "cdc_nwss",
    name: "CDC National Wastewater Surveillance System (NWSS)",
    country: "US",
    region_label: "United States — 1,500+ sites, all states & territories",
    pathogens: ["sars_cov_2", "influenza_a", "mpox", "measles"],
    earliest: "2020-01",
    access: "socrata",
    license: "Public domain (U.S. Government)",
    homepage: "https://www.cdc.gov/nwss/",
    tier: "A",
    implemented: true,
  },
  {
    id: "canada_phac",
    name: "Canada Health Infobase — National Wastewater Monitoring",
    country: "CA",
    region_label: "Canada — national network",
    pathogens: ["sars_cov_2", "influenza_a", "influenza_b", "rsv"],
    earliest: "2020-10",
    access: "csv",
    license: "Open Government Licence — Canada",
    homepage: "https://health-infobase.canada.ca/wastewater/",
    tier: "A",
    implemented: true,
  },
  {
    id: "esr_nz",
    name: "ESR — New Zealand Wastewater Surveillance",
    country: "NZ",
    region_label: "New Zealand — national",
    pathogens: ["sars_cov_2"],
    earliest: "2021-07",
    access: "github",
    license: "Open (ESR)",
    homepage: "https://github.com/ESR-NZ/covid_in_wastewater",
    tier: "A",
    implemented: true,
  },
  {
    id: "rivm_nl",
    name: "RIVM — Dutch National Sewage Surveillance",
    country: "NL",
    region_label: "Netherlands — ~300 treatment plants (~99% pop.)",
    pathogens: ["sars_cov_2"],
    earliest: "2020-03",
    access: "api",
    license: "CC-BY 4.0 / CC0",
    homepage: "https://www.rivm.nl/en/wastewater-research",
    tier: "A",
    implemented: false,
  },
  {
    id: "qld_au",
    name: "Queensland Health — Wastewater Surveillance",
    country: "AU",
    region_label: "Australia — Queensland",
    pathogens: ["sars_cov_2"],
    earliest: "2020-01",
    access: "socrata",
    license: "CC-BY 4.0",
    homepage:
      "https://www.data.qld.gov.au/dataset/queensland-wastewater-surveillance-for-sars-cov-2",
    tier: "A",
    implemented: false,
  },
];

export const SOURCE_BY_ID: Record<string, SourceManifest> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);
