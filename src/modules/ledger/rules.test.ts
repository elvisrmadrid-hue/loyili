import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/currencies";
import { amountExample, maxPurchaseMinor, parseMoneyAmount } from "./rules";

describe("parseMoneyAmount", () => {
  it("reads Colombian pesos: '.' groups thousands, ',' separates cents", () => {
    expect(parseMoneyAmount("25.500", "COP")).toBe(2_550_000);
    expect(parseMoneyAmount("25500", "COP")).toBe(2_550_000);
    expect(parseMoneyAmount("1.234.567", "COP")).toBe(123_456_700);
    expect(parseMoneyAmount("25.500,5", "COP")).toBe(2_550_050);
    expect(parseMoneyAmount("25.500,75", "COP")).toBe(2_550_075);
  });

  it("reads dollars and Mexican pesos: ',' groups thousands, '.' separates cents", () => {
    expect(parseMoneyAmount("12.50", "USD")).toBe(1250);
    expect(parseMoneyAmount("1,234.56", "USD")).toBe(123_456);
    expect(parseMoneyAmount("1234", "MXN")).toBe(123_400);
    expect(parseMoneyAmount("0.99", "USD")).toBe(99);
  });

  it("accepts spaces as thousands separators", () => {
    expect(parseMoneyAmount("25 500", "COP")).toBe(2_550_000);
    expect(parseMoneyAmount("1 000 000", "CRC")).toBe(100_000_000);
    expect(parseMoneyAmount("1 000", "CRC")).toBe(100_000);
  });

  it("does not accept cents in currencies without them (CLP, PYG)", () => {
    expect(parseMoneyAmount("25.500", "CLP")).toBe(25_500);
    expect(parseMoneyAmount("25.500,5", "CLP")).toBeNull();
    expect(parseMoneyAmount("15000", "PYG")).toBe(15_000);
  });

  it("rejects ambiguous amounts instead of guessing", () => {
    expect(parseMoneyAmount("25.5", "COP")).toBeNull(); // "." groups thousands in Colombia
    expect(parseMoneyAmount("12,50", "USD")).toBeNull(); // "," groups thousands in the US
    expect(parseMoneyAmount("1.0000", "COP")).toBeNull();
    expect(parseMoneyAmount("12.505", "USD")).toBeNull(); // 3 decimals
  });

  it("rejects empty, negative and non-numeric input", () => {
    expect(parseMoneyAmount("", "COP")).toBeNull();
    expect(parseMoneyAmount("   ", "COP")).toBeNull();
    expect(parseMoneyAmount("-500", "COP")).toBeNull();
    expect(parseMoneyAmount("$500", "COP")).toBeNull();
    expect(parseMoneyAmount("abc", "USD")).toBeNull();
  });

  it("knows the per-purchase cap in minor units", () => {
    expect(maxPurchaseMinor("COP")).toBe(10_000_000_000);
    expect(maxPurchaseMinor("CLP")).toBe(100_000_000);
  });
});

describe("amountExample / formatMoney", () => {
  it("writes amounts the way each country does", () => {
    expect(amountExample("COP")).toBe("25.500");
    expect(amountExample("USD")).toBe("25,500");
  });

  it("shows cents only when there are any", () => {
    expect(formatMoney(2_550_000, "COP")).toBe("$ 25.500");
    expect(formatMoney(2_550_075, "COP")).toBe("$ 25.500,75");
    expect(formatMoney(1250, "USD")).toBe("$12.50");
    expect(formatMoney(25_500, "CLP")).toBe("$25.500");
  });
});
