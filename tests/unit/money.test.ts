import { describe, expect, it } from "vitest";
import { allocateProportionally, formatBDT, fromMinor, mulDivRound, parseMoney, percentageOf, toMinor } from "@/lib/money";

describe("money", () => {
  it("parses decimal strings into integer poisha without floating point", () => {
    expect(parseMoney("1250")).toBe(125000);
    expect(parseMoney("1250.5")).toBe(125050);
    expect(parseMoney("1,250.05")).toBe(125005);
    expect(parseMoney("0.1")).toBe(10);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBe(-500);
  });

  it("round-trips through the database string format", () => {
    expect(fromMinor(125050)).toBe("1250.50");
    expect(fromMinor(5)).toBe("0.05");
    expect(toMinor("19.99")).toBe(1999);
    expect(toMinor({ toFixed: () => "0.30" })).toBe(30);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("formats BDT with lakh grouping", () => {
    expect(formatBDT(12500000)).toBe("৳1,25,000");
    expect(formatBDT(125050)).toBe("৳1,250.50");
    expect(formatBDT(0)).toBe("৳0");
  });

  it("rounds percentages half-up using integer arithmetic", () => {
    expect(percentageOf(10000, 1250)).toBe(1250); // 12.5% of ৳100
    expect(percentageOf(999, 5000)).toBe(500); // 49.95 → 50
    expect(mulDivRound(1, 1, 3)).toBe(0);
    expect(mulDivRound(2, 1, 3)).toBe(1);
  });

  it("allocates a total proportionally with parts that always sum exactly", () => {
    const parts = allocateProportionally(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
    expect(allocateProportionally(500, [300000, 100000])).toEqual([375, 125]);
    expect(allocateProportionally(0, [1, 2])).toEqual([0, 0]);
  });
});
