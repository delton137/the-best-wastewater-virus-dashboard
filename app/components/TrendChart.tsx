"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { fmtCount } from "../lib/format";

export type TrendYMode = "activity" | "units";

export interface TrendSeries {
  label: string;
  color: string;
  data: [string, number][]; // [weekISO, value]
  show?: boolean; // initial visibility; toggle via the legend checkbox
  unit?: string; // source unit, used for the y axis in "units" mode
}

const AXIS = { stroke: "#94a3c4", ticks: { stroke: "#26315044" } };
const GRID = { stroke: "#26315044" };
/** Axis labels drop the parenthetical detail, e.g. "(flow-population normalized)". */
const shortUnit = (unit: string) => unit.replace(/\s*\(.*\)\s*$/, "");

/** Align multiple [date,value] series onto a shared x axis (union of dates). */
function align(series: TrendSeries[]): uPlot.AlignedData {
  const dates = new Set<string>();
  for (const s of series) for (const [d] of s.data) dates.add(d);
  const xs = [...dates].sort();
  const xIndex = new Map(xs.map((d, i) => [d, i]));
  const xNum = xs.map((d) => Date.parse(d) / 1000);
  const ys = series.map((s) => {
    const arr = new Array<number | null>(xs.length).fill(null);
    for (const [d, v] of s.data) arr[xIndex.get(d)!] = v;
    return arr;
  });
  return [xNum, ...ys] as uPlot.AlignedData;
}

export default function TrendChart({
  series,
  mode = "activity",
}: {
  series: TrendSeries[];
  mode?: TrendYMode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  // Legend toggles by label, so switching y-axis mode keeps the user's selection.
  const visibility = useRef(new Map<string, boolean>());
  // In units mode the axes depend on which series are shown, so a toggle rebuilds the plot.
  const [visVersion, setVisVersion] = useState(0);

  const data = useMemo(() => align(series), [series]);
  // Rebuild when the mode or set/labels/units of series changes (not on every data tick),
  // and on legend toggles in units mode.
  const rebuildKey = [
    mode,
    mode === "units" ? visVersion : 0,
    ...series.map((s) => `${s.label}:${s.unit ?? ""}`),
  ].join("|");

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let plot: uPlot | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;

    const isShown = (s: TrendSeries) => visibility.current.get(s.label) ?? s.show ?? true;
    // Activity: one shared 0–100 axis. Units: one scale per physical unit (US and NZ share
    // copies/person/day), with an axis — left, then right — only for units of shown series.
    const unitOf = (s: TrendSeries) => shortUnit(s.unit ?? "");
    const units =
      mode === "units" ? [...new Set(series.map(unitOf))] : [];
    const scaleOf = (s: TrendSeries) =>
      mode === "units" ? `u${units.indexOf(unitOf(s))}` : "y";
    const axisUnits = units.filter((unit) =>
      series.some((s) => isShown(s) && unitOf(s) === unit),
    );
    const scales: uPlot.Scales =
      mode === "units"
        ? Object.fromEntries(
            units.map((_, i) => [
              `u${i}`,
              {
                range: (_u: uPlot, _min: number, max: number) =>
                  [0, max > 0 ? max * 1.05 : 1] as uPlot.Range.MinMax,
              },
            ]),
          )
        : { y: { range: [0, 100] } };
    const yAxes: uPlot.Axis[] =
      mode === "units"
        ? axisUnits.map((unit, i) => ({
            ...AXIS,
            scale: `u${units.indexOf(unit)}`,
            side: i % 2 ? 1 : 3,
            grid: i ? { show: false } : GRID,
            label: unit,
            values: (_u, splits) => splits.map((v) => fmtCount(v)),
            size: 60,
          }))
        : [{ ...AXIS, grid: GRID, label: "Within-site activity (0–100)" }];

    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height: 320,
      scales,
      legend: {
        show: true,
        // Filled marker = checked box; CSS draws the check mark and empties it when off.
        markers: { fill: (_u, i) => series[i - 1]?.color ?? "transparent" },
      },
      axes: [{ ...AXIS, grid: GRID }, ...yAxes],
      hooks: {
        setSeries: [
          (u) => {
            u.series.forEach((s, i) => {
              if (i > 0) visibility.current.set(String(s.label), !!s.show);
            });
            if (mode === "units") setVisVersion((v) => v + 1);
          },
        ],
      },
      series: [
        { label: "Week" },
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          show: isShown(s),
          scale: scaleOf(s),
          points: { show: false },
          ...(mode === "units" && {
            value: (_u: uPlot, v: number | null) => fmtCount(v),
          }),
        })),
      ],
    };

    (async () => {
      const UPlot = (await import("uplot")).default;
      if (cancelled || !el.isConnected) return;
      plot = new UPlot(opts, data, el);
      plotRef.current = plot;
      ro = new ResizeObserver(() => {
        plot?.setSize({ width: el.clientWidth, height: 320 });
      });
      ro.observe(el);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      plot?.destroy();
      plotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey]);

  // Update data in place when values change without a full rebuild.
  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data]);

  return <div ref={ref} className="trend-chart" style={{ width: "100%" }} />;
}
