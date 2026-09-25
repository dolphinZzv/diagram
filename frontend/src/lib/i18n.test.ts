import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

describe("translate", () => {
  it("returns localized strings", () => {
    expect(translate("zh", "topbar.save")).toBe("保存");
    expect(translate("en", "topbar.save")).toBe("Save");
    expect(translate("zh", "shape.diamond")).toBe("菱形");
    expect(translate("en", "shape.diamond")).toBe("Diamond");
  });

  it("interpolates variables", () => {
    expect(translate("en", "inspector.nodesN", { n: 3 })).toBe("3 nodes");
    expect(translate("en", "inspector.edgesN", { n: 5 })).toBe("5 edges");
    expect(translate("zh", "version.scale", { nodes: 2, edges: 1 })).toContain("2");
  });

  it("falls back to the key when missing", () => {
    expect(translate("en", "nope.missing.key")).toBe("nope.missing.key");
  });

  it("has matching key sets for zh and en", () => {
    // A few representative keys must exist in both languages.
    for (const key of ["topbar.save", "inspector.fill", "share.title", "viewer.readonly"]) {
      expect(translate("zh", key)).not.toBe(key);
      expect(translate("en", key)).not.toBe(key);
    }
  });
});
