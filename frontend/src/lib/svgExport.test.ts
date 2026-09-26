import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { diagramToSvg } from "./svgExport";
import { defaultEdgeData, defaultNodeData, type ShapeNodeData } from "./types";

function node(id: string, x: number, y: number, label: string, extra: Partial<ShapeNodeData> = {}): Node {
  const data: ShapeNodeData = { ...defaultNodeData("rect"), label, width: 120, height: 60, ...extra };
  return { id, type: "shape", position: { x, y }, data, style: { width: data.width, height: data.height } };
}

function edge(id: string, source: string, target: string, extra: Partial<ReturnType<typeof defaultEdgeData>> = {}): Edge {
  return {
    id,
    source,
    target,
    type: "custom",
    data: { ...defaultEdgeData(), ...extra },
  };
}

describe("diagramToSvg", () => {
  it("produces a self-contained svg without foreignObject", () => {
    const svg = diagramToSvg([node("a", 0, 0, "开始"), node("b", 200, 0, "结束")], [edge("e", "a", "b")]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toContain("foreignObject");
    expect(svg).toContain("<path");
    expect(svg).toContain("marker-end");
  });

  it("renders node labels as <text>", () => {
    const svg = diagramToSvg([node("a", 0, 0, "Hello")], []);
    expect(svg).toContain("<text");
    expect(svg).toContain("Hello");
  });

  it("escapes xml special characters in labels", () => {
    const svg = diagramToSvg([node("a", 0, 0, "<a & b>")], []);
    expect(svg).toContain("&lt;a &amp; b&gt;");
    expect(svg).not.toContain("<a & b>");
  });

  it("does not draw an arrow when arrowType is none", () => {
    const svg = diagramToSvg([node("a", 0, 0, ""), node("b", 200, 0, "")], [
      edge("e", "a", "b", { arrowType: "none" }),
    ]);
    expect(svg).not.toContain("marker-end");
  });

  it("renders waypoint edges as a smooth path", () => {
    const svg = diagramToSvg([node("a", 0, 0, ""), node("b", 300, 0, "")], [
      edge("e", "a", "b", { points: [{ x: 100, y: 120 }] }),
    ]);
    expect(svg).toContain("<path");
    expect(svg).toContain("C");
  });

  it("handles an empty diagram", () => {
    const svg = diagramToSvg([], []);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
  });

  it("respects a solid vs dashed line style", () => {
    const dashed = diagramToSvg([node("a", 0, 0, ""), node("b", 200, 0, "")], [
      edge("e", "a", "b", { lineStyle: "dashed" }),
    ]);
    expect(dashed).toContain("stroke-dasharray");
  });
});

describe("attribute escaping (security)", () => {
  // Regression: unescaped attribute values let a crafted diagram inject a
  // <script> into the exported/served SVG (stored XSS via the share image).
  const evil = 'x"/><script>alert(1)</script><text fill="';

  it("does not allow node textColor to inject markup", () => {
    const svg = diagramToSvg([node("a", 0, 0, "hi", { textColor: evil })], []);
    expect(svg).not.toContain("<script>");
  });

  it("does not allow edge color to inject markup", () => {
    const svg = diagramToSvg([node("a", 0, 0, ""), node("b", 200, 0, "")], [
      edge("e", "a", "b", { color: evil }),
    ]);
    expect(svg).not.toContain("<script>");
  });

  it("does not allow a subgraph node to inject markup", () => {
    const sg: Node = {
      id: "s1",
      type: "subgraph",
      position: { x: 0, y: 0 },
      data: { label: "nested", diagramId: "d1", width: 220, height: 150, fill: evil, stroke: evil, textColor: evil, opacity: 1 },
      style: { width: 220, height: 150 },
    };
    const svg = diagramToSvg([sg], []);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("nested");
  });
});
