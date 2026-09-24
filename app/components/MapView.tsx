"use client";

import { useEffect, useRef } from "react";
import type { Map as MlMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RegionMarker } from "../lib/aggregates";

export interface RegionSelection {
  country: string;
  admin1: string;
}

// Public OpenStreetMap raster tiles; browser requests retain normal HTTP caching.
const STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

function toGeoJSON(markers: RegionMarker[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: {
        country: m.country,
        admin1: m.admin1,
        value: m.value,
        n_sites: m.n_sites,
        latest_date: m.latest_date,
        label: `${m.admin1}, ${m.country}`,
      },
    })),
  };
}

export default function MapView({
  markers,
  onSelect,
}: {
  markers: RegionMarker[];
  onSelect: (sel: RegionSelection) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE,
        // Fit the contiguous US to the actual panel size, including narrow screens.
        bounds: [[-125, 24], [-66, 50]],
        fitBoundsOptions: { padding: 40 },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);

      map.on("load", () => {
        map.addSource("regions", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "region-circles",
          type: "circle",
          source: "regions",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["sqrt", ["get", "n_sites"]],
              1,
              5,
              10,
              22,
            ],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "value"],
              0,
              "#2c7bb6",
              50,
              "#ffff8c",
              100,
              "#d7191c",
            ],
            "circle-opacity": 0.82,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#0b1020",
          },
        });
        readyRef.current = true;
        const src = map.getSource("regions") as GeoJSONSource | undefined;
        src?.setData(toGeoJSON(pendingRef.current));

        map.on("click", "region-circles", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          onSelectRef.current({
            country: String(f.properties?.country),
            admin1: String(f.properties?.admin1),
          });
        });
        map.on("mouseenter", "region-circles", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "region-circles", () => {
          map.getCanvas().style.cursor = "";
        });
      });
    })();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Keep latest markers available for the load handler, and push updates live.
  const pendingRef = useRef<RegionMarker[]>(markers);
  pendingRef.current = markers;
  useEffect(() => {
    if (!mapRef.current || !readyRef.current) return;
    const src = mapRef.current.getSource("regions") as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(markers));
  }, [markers]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
