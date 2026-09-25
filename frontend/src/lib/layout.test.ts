import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { layoutLayered } from "./layout";
import { layoutMindMap } from "./mindmap";
import { defaultNodeData } from "./types";

function node(id: string): Node {
  const data = defaultNodeData("rect");
  return { id, type: "shape", position: { x: 0, y: 0 }, data, style: { width: data.width, height: data.height } };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target, type: "custom", data: {} };
}

describe("layoutLayered", () => {
  it("orders layers along the main axis", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const laid = layoutLayered(nodes, [edge("a", "b"), edge("b", "c")], "TB");
    const y = Object.fromEntries(laid.map((n) => [n.id, n.position.y]));
    expect(y.a).toBeLessThan(y.b);
    expect(y.b).toBeLessThan(y.c);
  });

  it("supports left-to-right direction", () => {
    const nodes = [node("a"), node("b")];
    const laid = layoutLayered(nodes, [edge("a", "b")], "LR");
    const x = Object.fromEntries(laid.map((n) => [n.id, n.position.x]));
    expect(x.a).toBeLessThan(x.b);
  });

  it("leaves group children untouched", () => {
    const child: Node = { ...node("c"), parentId: "g" };
    const laid = layoutLayered([node("g"), child], [], "TB");
    expect(laid.find((n) => n.id === "c")!.position).toEqual({ x: 0, y: 0 });
  });
});

describe("layoutMindMap", () => {
  it("centres the root and splits children left/right", () => {
    const nodes = [node("root"), node("a"), node("b")];
    const laid = layoutMindMap(nodes, [edge("root", "a"), edge("root", "b")]);
    const byId = Object.fromEntries(laid.map((n) => [n.id, n.position]));
    expect(byId.root.x).toBe(0);
    // one child to the right, one to the left
    const xs = [byId.a.x, byId.b.x].sort((p, q) => p - q);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[1]).toBeGreaterThan(0);
  });

  it("respects an explicit root", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const laid = layoutMindMap(nodes, [edge("a", "b"), edge("b", "c")], "a");
    const byId = Object.fromEntries(laid.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBe(0);
  });
});
