"use client";

import { formatBDT } from "@/lib/money";
import { ColumnChart, type ColumnDatum } from "./column-chart";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function SalesByDayChart({ points }: { points: { day: string; gross: number }[] }) {
  const data: ColumnDatum[] = points.map((p) => ({
    key: p.day,
    label: new Date(`${p.day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value: p.gross,
    display: formatBDT(p.gross),
  }));
  return <ColumnChart data={data} title="Gross sales by day" valueLabel="Gross sales" formatTick={(v) => `৳${compact.format(v / 100)}`} />;
}

export function OrdersByDayChart({ points }: { points: { day: string; orders: number }[] }) {
  const data: ColumnDatum[] = points.map((p) => ({
    key: p.day,
    label: new Date(`${p.day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value: p.orders,
    display: `${p.orders} order${p.orders === 1 ? "" : "s"}`,
  }));
  return <ColumnChart data={data} title="Orders placed by day" valueLabel="Orders" integer formatTick={(v) => compact.format(v)} />;
}
