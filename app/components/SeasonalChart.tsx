"use client";

import { useEffect, useMemo, useRef } from "react";
import type uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { SeasonalEntry } from "../lib/aggregates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Older years cool (blue) → newer years warm (red), so seasonality reads at a glance. */
function colorForYear(idx: number, total: number): string {
  const hue = total <= 1 ? 210 : 210 - (210 * idx) / (total - 1);
  return `hsl(${Math.round(hue)}, 75%, 58%)`;
}

/** Compact objective-unit formatter: 3.0e7 → "30M". */
export function fmtCount(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}

/** Centered moving average over a window of `w` weekly points (w<=1 → no-op). */
function smooth(vals: number[], w: number): (number | null)[] {
  if (w <= 1) return vals;
  const half = Math.floor(w / 2);
  return vals.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(vals.length - 1, i + half); j++) {
      sum += vals[j];
      n++;
    }
    return n ? sum / n : null;
  });
}

export default function SeasonalChart({
  entry,
  logScale,
  smoothWeeks,
}: {
  entry: SeasonalEntry;
  logScale: boolean;
  smoothWeeks: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Each year has its own weekly points at fractional-month x positions. Smooth each year's
  // series independently, then build a shared x axis from the union of all positions (same
  // month/day → same x, so years align) and fill each year's column.
  const { data, years } = useMemo(() => {
    const ys = Object.keys(entry.years).sort();
    const perYear = ys.map((y) => {
      const pts = entry.years[y]; // sorted by x
      const sm = smooth(pts.map((p) => p[1]), smoothWeeks);
      return pts.map(([x], i) => [x, sm[i]] as [number, number | null]);
    });
    const xset = new Set<number>();
    for (const pairs of perYear) for (const [x] of pairs) xset.add(x);
    const xs = [...xset].sort((a, b) => a - b);
    const xIndex = new Map(xs.map((x, i) => [x, i]));
    const cols = perYear.map((pairs) => {
      const arr = new Array<number | null>(xs.length).fill(null);
      for (const [x, v] of pairs) arr[xIndex.get(x)!] = v;
      return arr;
    });
    return { data: [xs, ...cols] as uPlot.AlignedData, years: ys };
  }, [entry, smoothWeeks]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let plot: uPlot | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;

    const opts: uPlot.Options = {
      width: el.clientWidth || 640,
      height: 360,
      scales: {
        x: { time: false, range: [1, 13] },
        y: logScale
          ? { distr: 3 }
          : { range: (_u, _min, max) => [0, max * 1.05] },
      },
      legend: { show: true },
      axes: [
        {
          stroke: "#94a3c4",
          grid: { stroke: "#26315044" },
          ticks: { stroke: "#26315044" },
          splits: () => Array.from({ length: 12 }, (_, i) => i + 1),
          values: (_u, splits) => splits.map((s) => MONTHS[s - 1] ?? ""),
        },
        {
          stroke: "#94a3c4",
          grid: { stroke: "#26315044" },
          ticks: { stroke: "#26315044" },
          values: (_u, splits) => splits.map((s) => fmtCount(s)),
          size: 60,
        },
      ],
      series: [
        { label: "Month" },
        ...years.map((y, i) => ({
          label: y,
          stroke: colorForYear(i, years.length),
          width: 1.5,
          spanGaps: true,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => fmtCount(v),
        })),
      ],
    };

    (async () => {
      const UPlot = (await import("uplot")).default;
      if (cancelled || !el.isConnected) return;
      plot = new UPlot(opts, data, el);
      ro = new ResizeObserver(() =>
        plot?.setSize({ width: el.clientWidth, height: 360 }),
      );
      ro.observe(el);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      plot?.destroy();
    };
  }, [data, years, logScale]);

  return <div ref={ref} style={{ width: "100%" }} />;
}
