import { describe, expect, it } from "vitest";
import { joinPath, normalizeJoinCode } from "./rules";

describe("normalizeJoinCode", () => {
  it("accepts a valid code", () => {
    expect(normalizeJoinCode("K7P2QX")).toBe("K7P2QX");
  });

  it("uppercases and removes spaces and dashes", () => {
    expect(normalizeJoinCode("k7p2qx")).toBe("K7P2QX");
    expect(normalizeJoinCode(" K7P 2QX ")).toBe("K7P2QX");
    expect(normalizeJoinCode("K7P-2QX")).toBe("K7P2QX");
  });

  it("rejects look-alike characters that codes never contain", () => {
    expect(normalizeJoinCode("K7P2Q0")).toBeNull(); // zero
    expect(normalizeJoinCode("K7P2QO")).toBeNull(); // letter O
    expect(normalizeJoinCode("K7P2Q1")).toBeNull(); // one
    expect(normalizeJoinCode("K7P2QI")).toBeNull(); // letter I
  });

  it("rejects wrong lengths and other characters", () => {
    expect(normalizeJoinCode("")).toBeNull();
    expect(normalizeJoinCode("K7P2Q")).toBeNull();
    expect(normalizeJoinCode("K7P2QXA")).toBeNull();
    expect(normalizeJoinCode("K7P2Q!")).toBeNull();
    expect(normalizeJoinCode("K7P2QÑ")).toBeNull();
  });
});

describe("joinPath", () => {
  it("builds the public join page path", () => {
    expect(joinPath("K7P2QX")).toBe("/unirse/K7P2QX");
  });
});
