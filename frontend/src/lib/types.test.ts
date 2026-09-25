import { describe, expect, it } from "vitest";
import { defaultEdgeData, defaultNodeData, SHAPE_LIST, SHAPE_LABELS } from "./types";

describe("defaultNodeData", () => {
  it("returns sensible defaults for a rectangle", () => {
    const d = defaultNodeData("rect");
    expect(d.shape).toBe("rect");
    expect(d.width).toBeGreaterThan(0);
    expect(d.height).toBeGreaterThan(0);
    expect(d.fill).toBe("#ffffff");
    expect(d.rotation).toBe(0);
    expect(d.opacity).toBe(1);
  });

  it("gives ellipses a wider footprint than tall", () => {
    const d = defaultNodeData("ellipse");
    expect(d.width).toBeGreaterThan(d.height);
  });

  it("makes text nodes borderless and transparent", () => {
    const d = defaultNodeData("text");
    expect(d.fill).toBe("transparent");
    expect(d.stroke).toBe("transparent");
    expect(d.label).not.toBe("");
  });

  it("produces a definition for every shape in the palette", () => {
    for (const shape of SHAPE_LIST) {
      const d = defaultNodeData(shape);
      expect(SHAPE_LABELS[shape], `label for ${shape}`).toBeTruthy();
      expect(d.shape).toBe(shape);
      expect(d.width).toBeGreaterThan(0);
      expect(d.height).toBeGreaterThan(0);
    }
  });

  it("uses compact default sizes", () => {
    for (const shape of SHAPE_LIST) {
      const d = defaultNodeData(shape);
      expect(d.width, `width for ${shape}`).toBeLessThanOrEqual(140);
      expect(d.height, `height for ${shape}`).toBeLessThanOrEqual(130);
    }
  });
});

describe("defaultEdgeData", () => {
  it("defaults to a solid bezier with a closed end arrow", () => {
    const d = defaultEdgeData();
    expect(d.arrowType).toBe("arrowclosed");
    expect(d.startArrowType).toBe("none");
    expect(d.lineStyle).toBe("solid");
    expect(d.pathType).toBe("bezier");
    expect(d.points).toEqual([]);
    expect(d.animated).toBe(false);
  });

  it("returns a fresh points array each call", () => {
    const a = defaultEdgeData();
    const b = defaultEdgeData();
    a.points.push({ x: 1, y: 2 });
    expect(b.points).toHaveLength(0);
  });
});
