import { describe, expect, it } from "vitest";
import { formatCountdown, formatCustomerCode, normalizeCustomerCode } from "./rules";

describe("normalizeCustomerCode", () => {
  it("accepts a valid code, with or without the dash", () => {
    expect(normalizeCustomerCode("K7P2QX4M")).toBe("K7P2QX4M");
    expect(normalizeCustomerCode("K7P2-QX4M")).toBe("K7P2QX4M");
  });

  it("uppercases and removes spaces", () => {
    expect(normalizeCustomerCode("k7p2-qx4m")).toBe("K7P2QX4M");
    expect(normalizeCustomerCode(" K7P2 QX4M ")).toBe("K7P2QX4M");
  });

  it("rejects look-alike characters that codes never contain", () => {
    expect(normalizeCustomerCode("K7P2QX40")).toBeNull(); // zero
    expect(normalizeCustomerCode("K7P2QX4O")).toBeNull(); // letter O
    expect(normalizeCustomerCode("K7P2QX41")).toBeNull(); // one
    expect(normalizeCustomerCode("K7P2QX4I")).toBeNull(); // letter I
  });

  it("rejects wrong lengths, other characters and other QR codes", () => {
    expect(normalizeCustomerCode("")).toBeNull();
    expect(normalizeCustomerCode("K7P2QX4")).toBeNull();
    expect(normalizeCustomerCode("K7P2QX4MA")).toBeNull();
    expect(normalizeCustomerCode("K7P2QX4!")).toBeNull();
    expect(normalizeCustomerCode("K7P2QX")).toBeNull(); // a merchant join code
    expect(normalizeCustomerCode("http://localhost:3000/unirse/K7P2QX")).toBeNull();
  });
});

describe("formatCustomerCode", () => {
  it("splits the code in two groups of four", () => {
    expect(formatCustomerCode("K7P2QX4M")).toBe("K7P2-QX4M");
  });
});

describe("formatCountdown", () => {
  it("shows minutes and two-digit seconds", () => {
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(245)).toBe("4:05");
    expect(formatCountdown(9)).toBe("0:09");
  });

  it("never goes below zero", () => {
    expect(formatCountdown(-3)).toBe("0:00");
  });
});
