"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

const DEFAULT_SPLIT = 50;
const clamp = (value: number) => Math.min(75, Math.max(25, value));

export default function ResizablePanels({ left, right }: { left: ReactNode; right: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [dragging, setDragging] = useState(false);

  return (
    <div ref={ref} className={`layout${dragging ? " resizing" : ""}`}
      style={{ "--map-share": `${split}fr`, "--chart-share": `${100 - split}fr` } as CSSProperties}>
      {left}
      <div
        className="panel-divider"
        role="separator"
        aria-label="Resize map and chart panels"
        aria-orientation="vertical"
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={Math.round(split)}
        aria-valuetext={`Map ${Math.round(split)} percent`}
        tabIndex={0}
        title="Drag to resize. Arrow keys adjust; double-click resets."
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId) || !ref.current) return;
          const rect = ref.current.getBoundingClientRect();
          setSplit(clamp(((e.clientX - rect.left - 5) / (rect.width - 10)) * 100));
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        onDoubleClick={() => setSplit(DEFAULT_SPLIT)}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(e.key)) return;
          e.preventDefault();
          setSplit((value) => e.key === "Home" ? 25 : e.key === "End" ? 75 : e.key === "Enter" ? DEFAULT_SPLIT : clamp(value + (e.key === "ArrowLeft" ? -2 : 2)));
        }}
      />
      {right}
    </div>
  );
}
