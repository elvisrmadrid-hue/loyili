import { describe, expect, it } from "vitest";
import { installPlatform } from "./device";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
};

describe("installPlatform", () => {
  it("detects iPhone", () => {
    expect(installPlatform(UA.iphone, 5)).toBe("ios");
  });

  it("detects an iPad that reports itself as a Mac (touch screen)", () => {
    expect(installPlatform(UA.ipadDesktopMode, 5)).toBe("ios");
  });

  it("a real Mac (no touch) is not iOS", () => {
    expect(installPlatform(UA.ipadDesktopMode, 0)).toBe("other");
  });

  it("detects Android", () => {
    expect(installPlatform(UA.android, 5)).toBe("android");
  });

  it("anything else is other", () => {
    expect(installPlatform(UA.windows)).toBe("other");
    expect(installPlatform("")).toBe("other");
  });
});
