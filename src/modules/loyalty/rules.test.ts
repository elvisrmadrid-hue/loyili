import { describe, expect, it } from "vitest";
import { calculatePoints, describeRule, formatPoints, fromMinorUnits, parseWholeAmount, toMinorUnits } from "./rules";

// "1 point per 1,000" in Colombian pesos (2 decimals): 1,000 COP = 100,000 minor units.
const onePerThousandCop = { pointsPerBlock: 1, blockAmountMinor: 100_000 };

describe("calculatePoints", () => {
  it("rounds down: only complete blocks count", () => {
    expect(calculatePoints(270_000, onePerThousandCop)).toBe(2); // $2,700 -> 2
    expect(calculatePoints(299_999, onePerThousandCop)).toBe(2);
    expect(calculatePoints(300_000, onePerThousandCop)).toBe(3);
  });

  it("gives 0 points below one block", () => {
    expect(calculatePoints(90_000, onePerThousandCop)).toBe(0); // $900 -> 0
  });

  it("multiplies by the points of each block", () => {
    expect(calculatePoints(270_000, { pointsPerBlock: 5, blockAmountMinor: 100_000 })).toBe(10);
  });

  it("works with currencies without decimals (CLP)", () => {
    const rule = { pointsPerBlock: 1, blockAmountMinor: toMinorUnits(1000, "CLP") };
    expect(calculatePoints(2700, rule)).toBe(2);
  });

  it("is exact with large amounts", () => {
    const rule = { pointsPerBlock: 1, blockAmountMinor: 3 };
    // Just below 2^53: floating-point division could round this up.
    expect(calculatePoints(9_007_199_254_740_990, rule)).toBe(3_002_399_751_580_330);
    expect(calculatePoints(9_007_199_254_740_989, rule)).toBe(3_002_399_751_580_329);
  });

  it("gives 0 for zero, negative or non-integer amounts", () => {
    expect(calculatePoints(0, onePerThousandCop)).toBe(0);
    expect(calculatePoints(-100_000, onePerThousandCop)).toBe(0);
    expect(calculatePoints(150_000.5, onePerThousandCop)).toBe(0);
  });
});

describe("toMinorUnits / fromMinorUnits", () => {
  it("uses 2 decimals for most currencies", () => {
    expect(toMinorUnits(1000, "COP")).toBe(100_000);
    expect(toMinorUnits(1, "USD")).toBe(100);
    expect(fromMinorUnits(100_000, "COP")).toBe(1000);
  });

  it("uses no decimals for CLP and PYG", () => {
    expect(toMinorUnits(1000, "CLP")).toBe(1000);
    expect(toMinorUnits(5000, "PYG")).toBe(5000);
    expect(fromMinorUnits(1000, "CLP")).toBe(1000);
  });

  it("round-trips the largest allowed block amount", () => {
    const minor = toMinorUnits(100_000_000, "COP");
    expect(minor).toBe(10_000_000_000);
    expect(fromMinorUnits(minor, "COP")).toBe(100_000_000);
  });
});

describe("parseWholeAmount", () => {
  it("accepts plain digits", () => {
    expect(parseWholeAmount("1000")).toBe(1000);
    expect(parseWholeAmount(" 25 ")).toBe(25);
  });

  it("accepts thousands separators", () => {
    expect(parseWholeAmount("1.000")).toBe(1000);
    expect(parseWholeAmount("1,000")).toBe(1000);
    expect(parseWholeAmount("1 000 000")).toBe(1_000_000);
    expect(parseWholeAmount("12.345.678")).toBe(12_345_678);
  });

  it("rejects decimals instead of reading them as bigger numbers", () => {
    expect(parseWholeAmount("1,50")).toBeNull();
    expect(parseWholeAmount("12.5")).toBeNull();
    expect(parseWholeAmount("1.0000")).toBeNull();
  });

  it("rejects empty, negative and non-numeric input", () => {
    expect(parseWholeAmount("")).toBeNull();
    expect(parseWholeAmount("-5")).toBeNull();
    expect(parseWholeAmount("abc")).toBeNull();
    expect(parseWholeAmount("$1000")).toBeNull();
  });
});

describe("describeRule / formatPoints", () => {
  it("writes the rule the way the currency's country does", () => {
    expect(describeRule(onePerThousandCop, "COP")).toBe("1 punto por cada $ 1.000");
    expect(describeRule({ pointsPerBlock: 5, blockAmountMinor: 1000 }, "MXN")).toBe("5 puntos por cada $10");
  });

  it("uses singular only for exactly one point", () => {
    expect(formatPoints(0, "CLP")).toBe("0 puntos");
    expect(formatPoints(1, "CLP")).toBe("1 punto");
    expect(formatPoints(1500, "CLP")).toBe("1.500 puntos");
  });
});
