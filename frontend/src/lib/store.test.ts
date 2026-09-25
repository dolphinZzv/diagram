import { beforeEach, describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { useEditor } from "./store";
import { defaultEdgeData, defaultNodeData, type ShapeNodeData } from "./types";

function mkNode(id: string, x: number, y: number, w = 100, h = 50): Node {
  const data: ShapeNodeData = { ...defaultNodeData("rect"), width: w, height: h, label: id };
  return { id, type: "shape", position: { x, y }, data, style: { width: w, height: h } };
}

function mkEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "custom", data: defaultEdgeData() };
}

function reset() {
  useEditor.setState({
    nodes: [],
    edges: [],
    selected: null,
    selectedIds: [],
    past: [],
    future: [],
    meta: { id: null, name: "test", description: "", saved: true, saving: false },
  });
}

beforeEach(reset);

describe("addShapeNode", () => {
  it("appends a node with default data and marks the doc dirty", () => {
    useEditor.getState().addShapeNode("ellipse", { x: 10, y: 20 });
    const { nodes, meta } = useEditor.getState();
    expect(nodes).toHaveLength(1);
    const n = nodes[0];
    expect(n.type).toBe("shape");
    expect(n.position).toEqual({ x: 10, y: 20 });
    expect((n.data as ShapeNodeData).shape).toBe("ellipse");
    expect(meta.saved).toBe(false);
  });
});

describe("onConnect", () => {
  it("creates a custom edge with default data", () => {
    useEditor.getState().onConnect({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
    const { edges } = useEditor.getState();
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("custom");
    expect((edges[0].data as Record<string, unknown>).arrowType).toBe("arrowclosed");
  });
});

describe("removeSelected", () => {
  it("removes selected nodes and their edges", () => {
    useEditor.setState({
      nodes: [mkNode("a", 0, 0), mkNode("b", 200, 0), mkNode("c", 400, 0)],
      edges: [mkEdge("e1", "a", "b"), mkEdge("e2", "b", "c")],
    });
    useEditor.setState({ selectedIds: ["b"], selected: "b" });
    useEditor.getState().removeSelected();
    const { nodes, edges, selectedIds } = useEditor.getState();
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "c"]);
    expect(edges.map((e) => e.id)).toEqual([]);
    expect(selectedIds).toEqual([]);
  });
});

describe("duplicateSelected", () => {
  it("clones nodes with an offset and duplicates internal edges", () => {
    useEditor.setState({
      nodes: [mkNode("a", 0, 0), mkNode("b", 200, 0)],
      edges: [mkEdge("e1", "a", "b")],
    });
    useEditor.setState({ selectedIds: ["a", "b"] });
    useEditor.getState().duplicateSelected();
    const { nodes, edges } = useEditor.getState();
    expect(nodes).toHaveLength(4);
    expect(edges).toHaveLength(2);
    const clone = nodes.find((n) => n.id !== "a" && n.id !== "b")!;
    expect(clone.position.x).toBeGreaterThanOrEqual(40);
  });
});

describe("undo / redo", () => {
  it("restores the previous state", () => {
    const store = useEditor.getState();
    store.addShapeNode("rect", { x: 0, y: 0 });
    expect(useEditor.getState().nodes).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().nodes).toHaveLength(0);
    useEditor.getState().redo();
    expect(useEditor.getState().nodes).toHaveLength(1);
  });
});

describe("alignNodes", () => {
  it("aligns left edges to the minimum x", () => {
    useEditor.setState({
      nodes: [mkNode("a", 100, 0, 100, 50), mkNode("b", 300, 100, 100, 50), mkNode("c", 50, 200, 100, 50)],
      selectedIds: ["a", "b", "c"],
    });
    useEditor.getState().alignNodes("left");
    const xs = useEditor.getState().nodes.map((n) => n.position.x);
    expect(new Set(xs)).toEqual(new Set([50]));
  });

  it("does nothing with fewer than two selected nodes", () => {
    useEditor.setState({ nodes: [mkNode("a", 100, 0)], selectedIds: ["a"] });
    useEditor.getState().alignNodes("left");
    expect(useEditor.getState().nodes[0].position.x).toBe(100);
  });
});

describe("distributeNodes", () => {
  it("spaces three nodes evenly along the horizontal axis", () => {
    useEditor.setState({
      nodes: [mkNode("a", 0, 0, 100, 50), mkNode("b", 50, 0, 100, 50), mkNode("c", 300, 0, 100, 50)],
      selectedIds: ["a", "b", "c"],
    });
    useEditor.getState().distributeNodes("horizontal");
    const byId = Object.fromEntries(useEditor.getState().nodes.map((n) => [n.id, n.position.x]));
    // centers should be 50, 200, 350 => x = 0, 150, 300
    expect(byId.a).toBeCloseTo(0);
    expect(byId.b).toBeCloseTo(150);
    expect(byId.c).toBeCloseTo(300);
  });
});

describe("updateManyNodes", () => {
  it("applies a patch to all given nodes", () => {
    useEditor.setState({ nodes: [mkNode("a", 0, 0), mkNode("b", 10, 0)] });
    useEditor.getState().updateManyNodes(["a", "b"], { fill: "#ff0000" });
    for (const n of useEditor.getState().nodes) {
      expect((n.data as ShapeNodeData).fill).toBe("#ff0000");
    }
  });
});

describe("loadDoc", () => {
  it("replaces content and clears history", () => {
    useEditor.getState().pushHistory();
    useEditor.getState().loadDoc([mkNode("x", 0, 0)], []);
    const s = useEditor.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
    expect(s.selectedIds).toEqual([]);
  });
});
