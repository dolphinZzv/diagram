import { describe, expect, it } from "vitest";
import { dashArray, polyline, smoothPathThrough } from "./geometry";

describe("dashArray", () => {
  it("maps line styles to stroke dash patterns", () => {
    expect(dashArray("solid")).toBeUndefined();
    expect(dashArray("dashed")).toBe("8 5");
    expect(dashArray("dotted")).toBe("1.5 5");
  });
});

describe("polyline", () => {
  it("returns empty string for no points", () => {
    expect(polyline([])).toBe("");
  });
  it("builds a single move for one point", () => {
    expect(polyline([{ x: 1, y: 2 }])).toBe("M 1,2 ");
  });
  it("chains line commands", () => {
    expect(
      polyline([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ])
    ).toBe("M 0,0 L 10,0 L 10,10");
  });
});

describe("smoothPathThrough", () => {
  it("returns empty string with fewer than 2 points", () => {
    expect(smoothPathThrough([])).toBe("");
    expect(smoothPathThrough([{ x: 1, y: 1 }])).toBe("");
  });
  it("uses a straight line for exactly two points", () => {
    expect(
      smoothPathThrough([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ])
    ).toBe("M 0,0 L 10,10");
  });
  it("uses cubic beziers through three or more points", () => {
    const d = smoothPathThrough([
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 100, y: 0 },
    ]);
    expect(d.startsWith("M 0,0")).toBe(true);
    expect(d).toContain("C");
  });
});
