import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { toMermaid } from "./mermaid";
import { defaultEdgeData, defaultNodeData, type ShapeNodeData } from "./types";

function node(id: string, shape: ShapeNodeData["shape"], label: string): Node {
  const data = { ...defaultNodeData(shape), label };
  return { id, type: "shape", position: { x: 0, y: 0 }, data, style: { width: data.width, height: data.height } };
}

function edge(id: string, source: string, target: string, extra: Record<string, unknown> = {}): Edge {
  return { id, source, target, type: "custom", data: { ...defaultEdgeData(), ...extra } };
}

describe("toMermaid", () => {
  it("emits a flowchart header and node declarations", () => {
    const md = toMermaid([node("a", "rect", "开始"), node("b", "diamond", "判断")], []);
    expect(md.startsWith("flowchart TD")).toBe(true);
    expect(md).toContain('a["开始"]');
    expect(md).toContain('b{"判断"}');
  });

  it("maps shapes to mermaid syntax", () => {
    const md = toMermaid(
      [
        node("r", "rounded", "r"),
        node("e", "ellipse", "e"),
        node("c", "cylinder", "c"),
        node("p", "parallelogram", "p"),
        node("h", "hexagon", "h"),
      ],
      []
    );
    expect(md).toContain('r("r")');
    expect(md).toContain('e(("e"))');
    expect(md).toContain('c[("c")]');
    expect(md).toContain('p[/"p"/]');
    expect(md).toContain('h{{"h"}}');
  });

  it("renders labeled and dashed edges", () => {
    const md = toMermaid(
      [node("a", "rect", "A"), node("b", "rect", "B"), node("c", "rect", "C")],
      [edge("e1", "a", "b", { label: "是" }), edge("e2", "b", "c", { lineStyle: "dashed" })]
    );
    expect(md).toContain("a -->|是| b");
    expect(md).toContain("b -.-> c");
  });

  it("skips edges pointing at unknown nodes and groups", () => {
    const md = toMermaid([node("a", "rect", "A")], [edge("e", "a", "ghost")]);
    expect(md).not.toContain("ghost");
  });

  it("supports LR direction", () => {
    expect(toMermaid([node("a", "rect", "A")], [], "LR").startsWith("flowchart LR")).toBe(true);
  });
});
