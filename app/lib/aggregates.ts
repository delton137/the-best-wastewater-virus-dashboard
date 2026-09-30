// Types + loaders for the pre-built JSON aggregates served from /public/aggregates.
// These are produced by the ingestion pipeline (ingestion/lib/writers.ts).

import type { Pathogen } from "@shared/schema";

export interface RegionMarker {
  country: string;
  admin1: string;
  pathogen: Pathogen;
  value: number; // mean within-site percentile (0-100), last 28 days
  n_sites: number;
  latest_date: string;
  lat: number;
  lon: number;
  sources: string[]; // contributing source_ids (provenance)
}

/** key = `${country}__${admin1|ALL}__${pathogen}` → [weekISO, value][] */
export type Trends = Record<string, [string, number][]>;

/** Trends in each source's own units: weekly median across sites of per-site weekly medians. */
export interface TrendsUnits {
  units: Record<string, string>; // `${country}__${pathogen}` → unit
  series: Trends; // same keys as Trends
}

export interface SourceCoverage {
  source_id: string;
  rows: number;
  min_date: string;
  max_date: string;
  n_sites: number;
  pathogens: Pathogen[];
  provenance_urls: string[]; // exact dataset URLs the rows were fetched from
  units: string[]; // raw units as published
  retrieved_at: string;
}

export interface Meta {
  total_rows: number;
  pathogens: Pathogen[];
  countries: string[];
  generated_at: string;
}

/** seasonal[country][pathogen] = weekly (per-site) national median, one array per year. */
export interface SeasonalEntry {
  unit: string;
  sources: string[]; // contributing source_ids (provenance)
  provenance_urls: string[]; // exact dataset URLs
  years: Record<string, [number, number, number][]>; // [fractionalMonth(1-13), value, n_sites]
}
export type Seasonal = Record<string, Record<string, SeasonalEntry>>;

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`/aggregates/${name}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load ${name}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadRegions = () => getJson<RegionMarker[]>("regions.json");
export const loadTrends = () => getJson<Trends>("trends.json");
export const loadTrendsUnits = () => getJson<TrendsUnits>("trends_units.json");
export const loadCoverage =() => getJson<SourceCoverage[]>("coverage.json");
export const loadMeta = () => getJson<Meta>("meta.json");
export const loadSeasonal = () => getJson<Seasonal>("seasonal.json");

export function trendKey(
  country: string,
  admin1: string,
  pathogen: string,
): string {
  return `${country}__${admin1}__${pathogen}`;
}
