"use client";

import { useEffect, useMemo, useRef } from "react";
import type uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export interface TrendSeries {
  label: string;
  color: string;
  data: [string, number][]; // [weekISO, value]
}

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

export default function TrendChart({ series }: { series: TrendSeries[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  const data = useMemo(() => align(series), [series]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let plot: uPlot | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;

    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height: 320,
      scales: { y: { range: [0, 100] } },
      legend: { show: true },
      axes: [
        {
          stroke: "#94a3c4",
          grid: { stroke: "#26315044" },
          ticks: { stroke: "#26315044" },
        },
        {
          stroke: "#94a3c4",
          grid: { stroke: "#26315044" },
          ticks: { stroke: "#26315044" },
          label: "Within-site activity (0–100)",
        },
      ],
      series: [
        { label: "Week" },
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          points: { show: false },
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
    // Rebuild when the set/labels of series changes (not on every data tick).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.map((s) => s.label).join("|")]);

  // Update data in place when values change without a full rebuild.
  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data]);

  return <div ref={ref} style={{ width: "100%" }} />;
}
