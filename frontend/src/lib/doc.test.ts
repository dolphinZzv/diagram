import { describe, expect, it } from "vitest";
import { normalizeEdges, normalizeNodes, parseDiagramFile, serializeDoc } from "./doc";

describe("normalizeNodes", () => {
  it("fills in defaults for a partial node", () => {
    const [n] = normalizeNodes([{ id: "a", position: { x: 5, y: 6 }, data: { shape: "diamond" } }]);
    expect(n.id).toBe("a");
    expect(n.type).toBe("shape");
    expect(n.position).toEqual({ x: 5, y: 6 });
    const data = n.data as Record<string, unknown>;
    expect(data.shape).toBe("diamond");
    expect(typeof data.fill).toBe("string");
    expect(typeof data.width).toBe("number");
    expect(n.style).toBeTruthy();
  });

  it("keeps ids and generates one when missing", () => {
    const nodes = normalizeNodes([{ data: { shape: "rect" } }, { id: "kept", data: { shape: "rect" } }]);
    expect(nodes[0].id).toMatch(/^n_/);
    expect(nodes[1].id).toBe("kept");
  });

  it("handles empty input", () => {
    expect(normalizeNodes([])).toEqual([]);
  });
});

describe("normalizeEdges", () => {
  it("forces the custom edge type and default data", () => {
    const [e] = normalizeEdges([{ id: "e1", source: "a", target: "b" }]);
    expect(e.type).toBe("custom");
    const data = e.data as Record<string, unknown>;
    expect(data.arrowType).toBe("arrowclosed");
    expect(Array.isArray(data.points)).toBe(true);
  });
});

describe("parseDiagramFile", () => {
  it("parses a full diagram document", () => {
    const doc = parseDiagramFile({
      version: 1,
      type: "diagram",
      name: "架构",
      nodes: [{ id: "n1" }],
      edges: [{ id: "e1", source: "n1", target: "n1" }],
      viewport: { x: 1, y: 2, zoom: 1.5 },
    });
    expect(doc.name).toBe("架构");
    expect(doc.nodes).toHaveLength(1);
    expect(doc.edges).toHaveLength(1);
    expect(doc.viewport).toEqual({ x: 1, y: 2, zoom: 1.5 });
  });

  it("tolerates missing nodes/edges", () => {
    const doc = parseDiagramFile({});
    expect(doc.nodes).toEqual([]);
    expect(doc.edges).toEqual([]);
  });

  it("rejects non-objects", () => {
    expect(() => parseDiagramFile(null)).toThrow();
    expect(() => parseDiagramFile(42)).toThrow();
  });
});

describe("serializeDoc", () => {
  it("produces a round-trippable document", () => {
    const file = serializeDoc([], [], "name", "desc", { x: 0, y: 0, zoom: 1 });
    expect(file.type).toBe("diagram");
    expect(file.version).toBe(1);
    const parsed = parseDiagramFile(JSON.parse(JSON.stringify(file)));
    expect(parsed.name).toBe("name");
    expect(parsed.description).toBe("desc");
  });
});

describe("subgraph nodes (nested documents)", () => {
  it("keeps subgraph type, diagramId and size", () => {
    const [n] = normalizeNodes([
      { id: "s1", type: "subgraph", position: { x: 1, y: 2 }, data: { diagramId: "abc", label: "子图", width: 300, height: 200 } },
    ]);
    expect(n.type).toBe("subgraph");
    const data = n.data as Record<string, unknown>;
    expect(data.diagramId).toBe("abc");
    expect(data.label).toBe("子图");
    expect(data.width).toBe(300);
    expect((n.style as { width?: number }).width).toBe(300);
  });

  it("defaults a subgraph node without data", () => {
    const [n] = normalizeNodes([{ id: "s2", type: "subgraph", position: { x: 0, y: 0 } }]);
    const data = n.data as Record<string, unknown>;
    expect(typeof data.diagramId).toBe("string");
    expect(typeof data.width).toBe("number");
  });
});
