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

  it("emits a sequenceDiagram when lifeline nodes exist", () => {
    const lifelines = [
      { id: "a", type: "lifeline", position: { x: 0, y: 0 }, data: { label: "用户" } },
      { id: "b", type: "lifeline", position: { x: 230, y: 0 }, data: { label: "服务器" } },
    ] as unknown as Node[];
    const messages = [
      {
        id: "m",
        source: "a",
        target: "b",
        sourceHandle: "r1",
        targetHandle: "l1",
        type: "custom",
        data: { ...defaultEdgeData(), label: "请求" },
      },
      {
        id: "m2",
        source: "b",
        target: "a",
        sourceHandle: "l0",
        targetHandle: "r0",
        type: "custom",
        data: { ...defaultEdgeData(), label: "响应", lineStyle: "dashed" },
      },
    ] as unknown as Edge[];
    const md = toMermaid(lifelines, messages);
    expect(md.startsWith("sequenceDiagram")).toBe(true);
    expect(md).toContain("participant a as 用户");
    expect(md).toContain("participant b as 服务器");
    // row 0 before row 1
    expect(md.indexOf("b-->>a: 响应")).toBeLessThan(md.indexOf("a->>b: 请求"));
  });
});
