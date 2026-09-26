import { afterEach, describe, expect, it } from "vitest";
import { readDiagramIdFromUrl, setDiagramIdInUrl } from "./url";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("diagram id in url", () => {
  it("reads the ?id param", () => {
    window.history.replaceState(null, "", "/?id=abc-123");
    expect(readDiagramIdFromUrl()).toBe("abc-123");
  });

  it("returns null when absent", () => {
    window.history.replaceState(null, "", "/?v=5");
    expect(readDiagramIdFromUrl()).toBeNull();
  });

  it("sets the id while preserving other params", () => {
    window.history.replaceState(null, "", "/?v=5");
    setDiagramIdInUrl("uuid-1");
    expect(window.location.search).toContain("id=uuid-1");
    expect(window.location.search).toContain("v=5");
  });

  it("clears the id while preserving other params", () => {
    window.history.replaceState(null, "", "/?v=5&id=uuid-1");
    setDiagramIdInUrl(null);
    expect(readDiagramIdFromUrl()).toBeNull();
    expect(window.location.search).toContain("v=5");
  });
});
