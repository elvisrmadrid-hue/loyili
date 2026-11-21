import { describe, expect, it } from "vitest";
import { averageMinor, barWidth, parseReportPeriod, percentage } from "./rules";

describe("parseReportPeriod", () => {
  it("reads the valid periods", () => {
    expect(parseReportPeriod("7").days).toBe(7);
    expect(parseReportPeriod("90").days).toBe(90);
    expect(parseReportPeriod("todo").days).toBeNull();
  });

  it("falls back to 30 days for anything else", () => {
    expect(parseReportPeriod(undefined).days).toBe(30);
    expect(parseReportPeriod("15").days).toBe(30);
    expect(parseReportPeriod(["7"]).days).toBe(30);
  });
});

describe("percentage", () => {
  it("rounds to a whole number", () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
    expect(percentage(5, 5)).toBe(100);
  });

  it("is 0 without a total", () => {
    expect(percentage(0, 0)).toBe(0);
  });
});

describe("averageMinor", () => {
  it("rounds down to whole minor units", () => {
    expect(averageMinor(1000, 3)).toBe(333);
  });

  it("is 0 when there is nothing to average", () => {
    expect(averageMinor(0, 0)).toBe(0);
  });
});

describe("barWidth", () => {
  it("is proportional to the largest value", () => {
    expect(barWidth(50, 100)).toBe(50);
    expect(barWidth(100, 100)).toBe(100);
  });

  it("shows a sliver for small non-zero values and nothing for zero", () => {
    expect(barWidth(1, 1000)).toBe(2);
    expect(barWidth(0, 100)).toBe(0);
  });
});
