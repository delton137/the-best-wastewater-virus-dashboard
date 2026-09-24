"use client";

import { useEffect, useMemo, useState } from "react";
import { PATHOGEN_LABELS, PATHOGENS, type Pathogen } from "@shared/schema";
import {
  loadCoverage,
  loadMeta,
  loadRegions,
  loadTrends,
  trendKey,
  type Meta,
  type RegionMarker,
  type SourceCoverage,
  type Trends,
} from "../lib/aggregates";
import MapView, { type RegionSelection } from "./MapView";
import TrendChart, { type TrendSeries } from "./TrendChart";
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

export default function Dashboard({ initialView = "trends" }: { initialView?: "trends" | "seasonal" }) {
  const [view, setView] = useState(initialView);
  const [seasonalCountry, setSeasonalCountry] = useState("US");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [regions, setRegions] = useState<RegionMarker[]>([]);
  const [trends, setTrends] = useState<Trends>({});
  const [coverage, setCoverage] = useState<Record<string, SourceCoverage>>({});
  const [error, setError] = useState<string | null>(null);

  const [pathogen, setPathogen] = useState<Pathogen>("sars_cov_2");
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
    if (selection) {
      const out: TrendSeries[] = [];
      const regionData =
        trends[trendKey(selection.country, selection.admin1, pathogen)];
      if (regionData)
        out.push({
          label: `${selection.admin1}, ${selection.country}`,
          color: "#e6ebf5",
          data: regionData,
        });
      const natData = trends[trendKey(selection.country, "ALL", pathogen)];
      if (natData)
        out.push({
          label: `${COUNTRY_NAMES[selection.country] ?? selection.country} (national)`,
          color: COUNTRY_COLORS[selection.country] ?? "#94a3c4",
          data: natData,
        });
      return out;
    }
    // No selection → national series for every country with data for this pathogen.
    const countries = meta?.countries ?? [];
    return countries
      .map((c) => ({ c, data: trends[trendKey(c, "ALL", pathogen)] }))
      .filter((x) => x.data && x.data.length)
      .map(({ c, data }) => ({
        label: COUNTRY_NAMES[c] ?? c,
        color: COUNTRY_COLORS[c] ?? "#94a3c4",
        data: data!,
      }));
  }, [selection, trends, pathogen, meta]);

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

  if (error)
    return (
      <div className="panel">
        <p className="muted">Could not load data: {error}</p>
        <p className="muted">
          Run the ingestion pipeline first: <code>npm run ingest -- --all</code>
        </p>
      </div>
    );

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
        <div className="trend-meta">
          {selection ? (
            <button className="chip" onClick={() => setSelection(null)}>
              ← back to national
            </button>
          ) : (
            "Click a region on the map to drill in. Values are each site's percentile within its own history (0–100), averaged."
          )}
        </div>

        {series.length ? (
          <TrendChart series={series} />
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
