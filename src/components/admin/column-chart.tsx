"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Single-series column chart (SVG). Spec: ≤24px columns with a 4px rounded data end and
 * square baseline, hairline solid gridlines, compact y ticks, per-column hover/focus
 * tooltip with a hit area wider than the mark, and a table view so no value is
 * hover-gated. Series colour #B07D2A was validated (lightness, chroma, ≥3:1 contrast)
 * against the white chart surface.
 */
export type ColumnDatum = { key: string; label: string; value: number; display: string };

const SERIES = "#B07D2A";
const GRID = "#ECE6DA";
const AXIS_TEXT = "#6B6B6B";
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

function niceStep(max: number, targetTicks = 4) {
  if (max <= 0) return 1;
  const raw = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return nice * magnitude;
}

function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function ColumnChart({
  data,
  title,
  formatTick,
  valueLabel,
  integer,
}: {
  data: ColumnDatum[];
  title: string;
  formatTick: (value: number) => string;
  valueLabel: string;
  /** Whole-number data (counts): ticks never fall between integers. */
  integer?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...data.map((d) => d.value));
  const step = integer ? Math.max(1, Math.round(niceStep(max))) : niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : plotW;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64))));
  const activeDatum = active !== null ? data[active] : null;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div ref={containerRef} className="relative w-full" onMouseLeave={() => setActive(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label={`${title}. ${data.length} data points; see the table below for exact values.`} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatTick(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const h = Math.max(0, (d.value / top) * plotH);
            return (
              <g key={d.key}>
                <path d={barPath(cx - barW / 2, y(d.value), barW, h)} fill={SERIES} opacity={active === null || active === i ? 1 : 0.55} />
                {i % labelEvery === 0 ? (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                    {d.label}
                  </text>
                ) : null}
                {/* Hit area: the whole column band, larger than the painted mark. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${d.display}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  style={{ outline: "none" }}
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#D9D1C0" strokeWidth={1} />
        </svg>
        {activeDatum && active !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(PAD.left + band * active + band / 2 - 70, 0), width - 150),
              top: Math.max(0, y(activeDatum.value) - 58),
              width: 140,
            }}
          >
            <p className="text-sm font-semibold text-ink">{activeDatum.display}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-muted">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: SERIES }} aria-hidden="true" />
              {valueLabel} · {activeDatum.label}
            </p>
          </div>
        ) : null}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted hover:text-ink" aria-controls={tableId}>
          View as table
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table id={tableId} className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="py-1">{d.label}</td>
                  <td className="py-1 text-right tabular-nums">{d.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
