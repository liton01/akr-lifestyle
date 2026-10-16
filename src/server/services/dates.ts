/** Calendar parts of `date` in a given IANA time zone. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset (ms) of the time zone from UTC at `date`. */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight (start of day) in the time zone for the given local date. */
export function startOfZonedDay(year: number, month: number, day: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

export function startOfTodayInZone(now: Date, timeZone: string): Date {
  const p = zonedParts(now, timeZone);
  return startOfZonedDay(p.year, p.month, p.day, timeZone);
}

export function startOfMonthInZone(now: Date, timeZone: string): Date {
  const p = zonedParts(now, timeZone);
  return startOfZonedDay(p.year, p.month, 1, timeZone);
}

/** Parse "YYYY-MM-DD" as a local date in the time zone → UTC instant at local midnight. */
export function parseZonedDate(value: string | undefined, timeZone: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return startOfZonedDay(y, m, d, timeZone);
}

export function formatZonedDateInput(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
