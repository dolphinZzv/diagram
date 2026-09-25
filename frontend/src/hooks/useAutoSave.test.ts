import { afterEach, describe, expect, it } from "vitest";
import { isAutoSaveEnabled, setAutoSaveEnabled } from "./useAutoSave";

afterEach(() => {
  try {
    localStorage.removeItem("diagram_autosave");
  } catch {
    /* ignore */
  }
});

describe("auto-save preference", () => {
  it("is enabled by default", () => {
    expect(isAutoSaveEnabled()).toBe(true);
  });

  it("can be disabled and re-enabled", () => {
    setAutoSaveEnabled(false);
    expect(isAutoSaveEnabled()).toBe(false);
    setAutoSaveEnabled(true);
    expect(isAutoSaveEnabled()).toBe(true);
  });
});
