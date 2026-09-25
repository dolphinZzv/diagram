import { afterEach, describe, expect, it } from "vitest";
import { canvasColors, useTheme } from "./theme";

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("theme", () => {
  it("provides distinct palettes per theme", () => {
    const light = canvasColors("light");
    const dark = canvasColors("dark");
    expect(light.dots).toMatch(/^#/);
    expect(dark.dots).toMatch(/^#/);
    expect(light.exportBg).not.toBe(dark.exportBg);
  });

  it("applies and removes the dark class on <html>", () => {
    useTheme.getState().setTheme("dark");
    expect(useTheme.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    useTheme.getState().setTheme("light");
    expect(useTheme.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles between light and dark", () => {
    useTheme.getState().setTheme("light");
    useTheme.getState().toggle();
    expect(useTheme.getState().theme).toBe("dark");
    useTheme.getState().toggle();
    expect(useTheme.getState().theme).toBe("light");
  });
});
