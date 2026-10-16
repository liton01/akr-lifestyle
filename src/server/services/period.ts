import { addDays, formatZonedDateInput, parseZonedDate, startOfMonthInZone, startOfTodayInZone } from "@/server/services/dates";

export type PeriodPreset = "7d" | "30d" | "90d" | "month" | "custom";

export type Period = { from: Date; to: Date; preset: PeriodPreset; fromInput: string; toInput: string; label: string };

/** Resolve a dashboard/report period from query params in the store time zone. */
export function resolvePeriod(params: { range?: string; from?: string; to?: string }, timeZone: string, now = new Date()): Period {
  const todayStart = startOfTodayInZone(now, timeZone);
  const tomorrow = addDays(todayStart, 1);
  const customFrom = parseZonedDate(params.from, timeZone);
  const customTo = parseZonedDate(params.to, timeZone);
  if (customFrom && customTo && customTo >= customFrom && addDays(customTo, 1).getTime() - customFrom.getTime() <= 366 * 86_400_000) {
    return {
      from: customFrom,
      to: addDays(customTo, 1),
      preset: "custom",
      fromInput: params.from!,
      toInput: params.to!,
      label: `${params.from} – ${params.to}`,
    };
  }
  let from: Date;
  let preset: PeriodPreset;
  let label: string;
  switch (params.range) {
    case "7d":
      from = addDays(todayStart, -6);
      preset = "7d";
      label = "Last 7 days";
      break;
    case "90d":
      from = addDays(todayStart, -89);
      preset = "90d";
      label = "Last 90 days";
      break;
    case "month":
      from = startOfMonthInZone(now, timeZone);
      preset = "month";
      label = "This month";
      break;
    default:
      from = addDays(todayStart, -29);
      preset = "30d";
      label = "Last 30 days";
  }
  return { from, to: tomorrow, preset, fromInput: formatZonedDateInput(from, timeZone), toInput: formatZonedDateInput(todayStart, timeZone), label };
}
