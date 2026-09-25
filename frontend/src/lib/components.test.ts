import { beforeEach, describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  DEFAULT_CATEGORY,
  buildComponentFromSelection,
  componentBounds,
  parseComponentsJSON,
  useComponents,
  type ComponentDef,
} from "./components";
import { defaultNodeData } from "./types";

function node(id: string, x: number, y: number, w = 100, h = 50): Node {
  const data = { ...defaultNodeData("rect"), width: w, height: h };
  return { id, type: "shape", position: { x, y }, data, style: { width: w, height: h } };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "custom", data: {} };
}

beforeEach(() => {
  useComponents.setState({ components: [] });
  try {
    localStorage.removeItem("diagram_components_v1");
  } catch {
    /* ignore */
  }
});

describe("component library store", () => {
  const sample: ComponentDef = {
    id: "c_1",
    name: "gw",
    category: "net",
    kind: "single",
    nodes: [node("a", 0, 0)],
    edges: [],
    createdAt: 1,
  };

  it("adds, updates and removes components", () => {
    useComponents.getState().add(sample);
    expect(useComponents.getState().components).toHaveLength(1);
    useComponents.getState().update("c_1", { name: "gw2" });
    expect(useComponents.getState().components[0].name).toBe("gw2");
    useComponents.getState().remove("c_1");
    expect(useComponents.getState().components).toHaveLength(0);
  });

  it("persists to localStorage", () => {
    useComponents.getState().add(sample);
    const raw = localStorage.getItem("diagram_components_v1");
    expect(raw).toContain("gw");
  });
});

describe("buildComponentFromSelection", () => {
  it("builds a single-shape component re-based to origin", () => {
    const def = buildComponentFromSelection([node("a", 100, 50)], [], ["a"], "My", "");
    expect(def?.kind).toBe("single");
    expect(def?.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(def?.category).toBe(DEFAULT_CATEGORY);
  });

  it("builds a compound component with only internal edges", () => {
    const nodes = [node("a", 100, 50), node("b", 300, 50), node("c", 0, 0)];
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")];
    const def = buildComponentFromSelection(nodes, edges, ["a", "b"], "grp", "cat");
    expect(def?.kind).toBe("compound");
    expect(def?.nodes).toHaveLength(2);
    expect(def?.edges).toHaveLength(1);
    expect(def?.edges[0].source).toBe("a");
    expect(def?.nodes.find((n) => n.id === "a")!.position.x).toBe(0);
    expect(def?.nodes.find((n) => n.id === "b")!.position.x).toBe(200);
  });

  it("returns null without a selection", () => {
    expect(buildComponentFromSelection([node("a", 0, 0)], [], [], "x", "")).toBeNull();
  });
});

describe("componentBounds", () => {
  it("computes the bounding box", () => {
    const def = buildComponentFromSelection(
      [node("a", 0, 0, 100, 50), node("b", 200, 100, 100, 50)],
      [],
      ["a", "b"],
      "x",
      ""
    )!;
    const b = componentBounds(def);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.w).toBe(300);
    expect(b.h).toBe(150);
  });
});

describe("parseComponentsJSON", () => {
  it("parses a library object and fills missing ids", () => {
    const list = parseComponentsJSON({ version: 1, components: [{ name: "c", nodes: [{ id: "n" }] }] });
    expect(list).toHaveLength(1);
    expect(list[0].id).toMatch(/^c_/);
    expect(list[0].category).toBe(DEFAULT_CATEGORY);
  });

  it("accepts a bare array", () => {
    expect(parseComponentsJSON([{ nodes: [{ id: "n" }] }])).toHaveLength(1);
  });

  it("throws on invalid input", () => {
    expect(() => parseComponentsJSON({ nope: true })).toThrow();
    expect(() => parseComponentsJSON(42)).toThrow();
  });
});
