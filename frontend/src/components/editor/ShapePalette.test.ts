import { describe, expect, it } from "vitest";
import { buildIconNode } from "./ShapePalette";
import type { ShapeNodeData } from "@/lib/types";

describe("buildIconNode", () => {
  it("builds a rounded node carrying an icon and tone colors", () => {
    const node = buildIconNode("Database", "数据库", { x: 100, y: 50 });
    expect(node).not.toBeNull();
    const data = node!.data as ShapeNodeData;
    expect(data.icon).toBe("Database");
    expect(data.shape).toBe("rounded");
    expect(data.label).toBe("数据库");
    expect(data.fill).toMatch(/^#/);
    expect(data.stroke).toMatch(/^#/);
    expect(data.width).toBeGreaterThan(0);
    expect(data.height).toBeGreaterThan(0);
  });

  it("returns null for an unknown icon", () => {
    expect(buildIconNode("DefinitelyNotAnIcon", "x", { x: 0, y: 0 })).toBeNull();
  });
});
