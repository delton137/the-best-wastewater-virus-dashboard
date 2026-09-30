"use client";

import { useEffect, useMemo, useState } from "react";
import { PATHOGEN_LABELS, PATHOGENS, type Pathogen } from "@shared/schema";
import {
  loadCoverage,
  loadMeta,
  loadRegions,
  loadTrends,
  loadTrendsUnits,
  trendKey,
  type Meta,
  type RegionMarker,
  type SourceCoverage,
  type Trends,
  type TrendsUnits,
} from "../lib/aggregates";
import { isStale } from "../lib/freshness";
import MapView, { type RegionSelection } from "./MapView";
import TrendChart, { type TrendSeries, type TrendYMode } from "./TrendChart";
import Provenance from "./Provenance";
import ResizablePanels from "./ResizablePanels";
import SeasonalPanel from "./SeasonalPanel";

const COUNTRY_COLORS: Record<string, string> = {
  US: "#5b8cff",
  CA: "#ff6b6b",
  NZ: "#34d399",
  NL: "#fbbf24",
  AU: "#c084fc",
};
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  NZ: "New Zealand",
  NL: "Netherlands",
  AU: "Australia",
};

// Countries plotted on the national trends chart by default; others toggle on via the legend.
const DEFAULT_TREND_COUNTRIES = new Set(["US", "CA"]);

export default function Dashboard({ initialView = "trends" }: { initialView?: "trends" | "seasonal" }) {
  const [view, setView] = useState(initialView);
  const [seasonalCountry, setSeasonalCountry] = useState("US");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [regions, setRegions] = useState<RegionMarker[]>([]);
  const [trends, setTrends] = useState<Trends>({});
  const [coverage, setCoverage] = useState<Record<string, SourceCoverage>>({});
  const [error, setError] = useState<string | null>(null);

  const [pathogen, setPathogen] = useState<Pathogen>("sars_cov_2");
  const [yMode, setYMode] = useState<TrendYMode>("activity");
  const [trendsUnits, setTrendsUnits] = useState<TrendsUnits | null>(null);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [selection, setSelection] = useState<RegionSelection | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadRegions(), loadTrends(), loadCoverage()])
      .then(([m, r, t, c]) => {
        setMeta(m);
        setRegions(r);
        setTrends(t);
        setCoverage(Object.fromEntries(c.map((row) => [row.source_id, row])));
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Source-unit trends are only fetched the first time that y-axis mode is chosen.
  useEffect(() => {
    if (yMode !== "units" || trendsUnits) return;
    loadTrendsUnits().then(setTrendsUnits).catch((e) => setUnitsError(String(e)));
  }, [yMode, trendsUnits]);

  const availablePathogens = useMemo(
    () => new Set(meta?.pathogens ?? []),
    [meta],
  );

  const markers = useMemo(
    () => regions.filter((r) => r.pathogen === pathogen),
    [regions, pathogen],
  );

  // Clear a stale selection when switching to a pathogen the region lacks.
  useEffect(() => {
    if (
      selection &&
      !markers.some(
        (m) => m.country === selection.country && m.admin1 === selection.admin1,
      )
    ) {
      setSelection(null);
    }
  }, [markers, selection]);

  const series: TrendSeries[] = useMemo(() => {
    const source = yMode === "units" ? trendsUnits?.series : trends;
    if (!source) return [];
    const unitOf = (country: string) =>
      trendsUnits?.units[`${country}__${pathogen}`];
    if (selection) {
      const out: TrendSeries[] = [];
      const regionData =
        source[trendKey(selection.country, selection.admin1, pathogen)];
      if (regionData)
        out.push({
          label: `${selection.admin1}, ${selection.country}`,
          color: "#e6ebf5",
          data: regionData,
          unit: unitOf(selection.country),
        });
      const natData = source[trendKey(selection.country, "ALL", pathogen)];
      if (natData)
        out.push({
          label: `${COUNTRY_NAMES[selection.country] ?? selection.country} (national)`,
          color: COUNTRY_COLORS[selection.country] ?? "#94a3c4",
          data: natData,
          unit: unitOf(selection.country),
        });
      return out;
    }
    // No selection → national series for every country with data for this pathogen.
    const countries = meta?.countries ?? [];
    return countries
      .map((c) => ({ c, data: source[trendKey(c, "ALL", pathogen)] }))
      .filter((x) => x.data && x.data.length)
      .map(({ c, data }) => ({
        label: COUNTRY_NAMES[c] ?? c,
        color: COUNTRY_COLORS[c] ?? "#94a3c4",
        data: data!,
        show: DEFAULT_TREND_COUNTRIES.has(c),
        unit: unitOf(c),
      }));
  }, [selection, trends, trendsUnits, yMode, pathogen, meta]);

  const seriesUnits = [...new Set(series.map((s) => s.unit).filter(Boolean))];

  // Provenance for the current view: the selected region's sources, else the union across
  // all visible markers for this pathogen.
  const viewSources = useMemo(() => {
    const relevant = selection
      ? markers.filter(
          (m) => m.country === selection.country && m.admin1 === selection.admin1,
        )
      : markers;
    return [...new Set(relevant.flatMap((m) => m.sources ?? []))];
  }, [markers, selection]);

  const selectedMarker = selection
    ? markers.find((m) => m.country === selection.country && m.admin1 === selection.admin1)
    : null;

  if (error)
    return (
      <div className="panel">
        <p className="muted">Could not load data: {error}</p>
        <p className="muted">
          Run the ingestion pipeline first: <code>npm run ingest -- --all</code>
        </p>
      </div>
    );

  if (!meta) return <p className="panel muted" role="status">Loading wastewater data…</p>;

  return (
    <ResizablePanels left={
      <div className="panel map-panel">
        <MapView markers={markers} onSelect={(sel) => {
          setSelection(sel);
          setSeasonalCountry(sel.country);
        }} />
        <div className="legend">
          <div>Within-site activity level</div>
          <div className="bar" />
          <div className="ends">
            <span>low</span>
            <span>high</span>
          </div>
          <div style={{ marginTop: 4, color: "var(--muted)" }}>
            marker size = # sites
            <div>Gray = latest sample over 90 days old</div>
          </div>
        </div>
      </div>

      } right={<div className="panel">
        <div className="controls" role="group" aria-label="Chart view">
          {(["trends", "seasonal"] as const).map((option) => (
            <button key={option} className={`chip ${view === option ? "active" : ""}`}
              aria-pressed={view === option} onClick={() => setView(option)}>
              {option === "trends" ? "Trends" : "Seasonal"}
            </button>
          ))}
        </div>
        <div className="controls">
          {PATHOGENS.map((p) => (
            <button
              key={p}
              className={`chip ${p === pathogen ? "active" : ""}`}
              disabled={!availablePathogens.has(p)}
              onClick={() => setPathogen(p)}
              title={
                availablePathogens.has(p) ? "" : "No data ingested yet"
              }
            >
              {PATHOGEN_LABELS[p]}
            </button>
          ))}
        </div>

        {selectedMarker && (
          <p className="trend-meta">
            {selectedMarker.admin1}: latest sample {selectedMarker.latest_date}
            {isStale(selectedMarker.latest_date) ? " · Stale — over 90 days old" : ""}
          </p>
        )}
        {view === "seasonal" ? (
          <SeasonalPanel pathogen={pathogen} country={seasonalCountry}
            onCountryChange={setSeasonalCountry} coverage={coverage}
            updatedAt={meta?.generated_at} />
        ) : (<>
        <h2 className="section-title">
          {selection
            ? `${selection.admin1}, ${selection.country}`
            : "National trends"}{" "}
          — {PATHOGEN_LABELS[pathogen]}
        </h2>
        <div className="controls" role="group" aria-label="Trend y-axis">
          {(["activity", "units"] as const).map((option) => (
            <button key={option} className={`chip ${yMode === option ? "active" : ""}`}
              aria-pressed={yMode === option} onClick={() => setYMode(option)}>
              {option === "activity" ? "Within-site activity" : "Source units"}
            </button>
          ))}
        </div>
        <div className="trend-meta">
          {selection ? (
            <button className="chip" onClick={() => setSelection(null)}>
              ← back to national
            </button>
          ) : (
            "Click a region on the map to drill in."
          )}{" "}
          {yMode === "activity"
            ? "Values are each site's percentile within its own history (0–100), averaged."
            : `Values are the weekly median across sites in each source's own units (${seriesUnits.join("; ")}).${
                seriesUnits.length > 1
                  ? " Units differ by country, so they get separate axes; compare shapes, not heights, across countries."
                  : ""
              }`}
        </div>

        {yMode === "units" && unitsError ? (
          <p className="muted" role="alert">Could not load source-unit trends: {unitsError}</p>
        ) : yMode === "units" && !trendsUnits ? (
          <p className="muted" role="status">Loading source-unit trends…</p>
        ) : series.length ? (
          <TrendChart series={series} mode={yMode} />
        ) : (
          <p className="muted">No trend data for this selection yet.</p>
        )}

        <Provenance
          sources={viewSources}
          coverage={coverage}
          updatedAt={meta?.generated_at}
        />
        </>)}
      </div>}
    />
  );
}
