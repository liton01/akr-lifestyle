/**
 * Money helpers.
 *
 * All calculations use integer minor units (poisha, 1/100 BDT) held in JS numbers.
 * Integers are exact up to 2^53, far above any realistic order value.
 * Database DECIMAL(12,2) values are converted through their fixed-point string
 * representation, never through floating point.
 */

export type DecimalLike = { toFixed(dp: number): string };

const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Parse "1250", "1250.5" or "1250.50" into poisha. Returns null for invalid input. */
export function parseMoney(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  const match = MONEY_PATTERN.exec(trimmed);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) return null;
  return sign ? -minor : minor;
}

/** Convert a Prisma Decimal (or any decimal-like value) to poisha. */
export function toMinor(value: DecimalLike | string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Invalid money value");
    return parseMoneyStrict(value.toFixed(2));
  }
  if (typeof value === "string") return parseMoneyStrict(value);
  return parseMoneyStrict(value.toFixed(2));
}

export function toMinorOrNull(value: DecimalLike | string | number | null | undefined): number | null {
  return value === null || value === undefined ? null : toMinor(value);
}

function parseMoneyStrict(value: string): number {
  const parsed = parseMoney(value);
  if (parsed === null) throw new RangeError(`Invalid money value: ${value}`);
  return parsed;
}

/** Convert poisha to a decimal string accepted by Prisma, e.g. 125050 -> "1250.50". */
export function fromMinor(minor: number): string {
  assertInteger(minor);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Same as fromMinor but drops ".00" — used to prefill form inputs. */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const value = fromMinor(minor);
  return value.endsWith(".00") ? value.slice(0, -3) : value;
}

const groupFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Format poisha as Bangladeshi Taka, e.g. 12500000 -> "৳1,25,000". */
export function formatBDT(minor: number): string {
  assertInteger(minor);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const formatted = groupFormatter.format(whole) + (fraction ? `.${String(fraction).padStart(2, "0")}` : "");
  return `${negative ? "-" : ""}৳${formatted}`;
}

/** Round-half-up of (a * b) / c for non-negative integers, computed with BigInt. */
export function mulDivRound(a: number, b: number, c: number): number {
  assertInteger(a);
  assertInteger(b);
  assertInteger(c);
  if (a < 0 || b < 0 || c <= 0) throw new RangeError("mulDivRound expects non-negative operands");
  const result = (BigInt(a) * BigInt(b) * 2n + BigInt(c)) / (2n * BigInt(c));
  return Number(result);
}

/**
 * Percentage of an amount. `basisPoints` is the percentage × 100
 * (a DECIMAL(12,2) percentage like 12.50 converts to 1250 via toMinor).
 */
export function percentageOf(amountMinor: number, basisPoints: number): number {
  return mulDivRound(amountMinor, basisPoints, 10_000);
}

/**
 * Split `total` across `weights` proportionally using the largest-remainder method,
 * so the parts are integers that always sum exactly to `total`.
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  assertInteger(total);
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0 || total === 0) return weights.map(() => 0);

  const raw = weights.map((w) => {
    const numerator = BigInt(total) * BigInt(w);
    const floor = numerator / BigInt(weightSum);
    const remainder = numerator % BigInt(weightSum);
    return { floor: Number(floor), remainder };
  });
  let allocated = raw.reduce((sum, r) => sum + r.floor, 0);
  const order = raw
    .map((r, index) => ({ index, remainder: r.remainder }))
    .sort((x, y) => (y.remainder > x.remainder ? 1 : y.remainder < x.remainder ? -1 : x.index - y.index));
  const parts = raw.map((r) => r.floor);
  for (const { index } of order) {
    if (allocated >= total) break;
    parts[index] = (parts[index] ?? 0) + 1;
    allocated += 1;
  }
  return parts;
}

function assertInteger(value: number) {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Expected an integer amount, received ${value}`);
}
