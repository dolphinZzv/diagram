import { describe, expect, it } from "vitest";
import { parseDiagramText } from "./mermaidImport";
import type { ShapeNodeData } from "./types";

describe("parseDiagramText", () => {
  it("parses a Mermaid flowchart", () => {
    const { nodes, edges, kind } = parseDiagramText(
      ["flowchart TD", "  A[Start] --> B{OK?}", "  B -->|yes| C[End]"].join("\n")
    );
    expect(kind).toBe("flowchart");
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, (n.data as ShapeNodeData).shape]));
    expect(byId.A).toBe("rect");
    expect(byId.B).toBe("diamond");
    expect((edges.find((e) => e.target === "C")!.data as { label: string }).label).toBe("yes");
  });

  it("parses a Mermaid sequence diagram", () => {
    const { nodes, edges, kind } = parseDiagramText(
      ["sequenceDiagram", "  participant A as 用户", "  participant B as 服务器", "  A->>B: 请求"].join("\n")
    );
    expect(kind).toBe("sequence");
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.type === "lifeline")).toBe(true);
    expect((nodes[0].data as ShapeNodeData).label).toBe("用户");
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceHandle).toMatch(/^[lr]0$/);
  });

  it("parses PlantUML activity", () => {
    const { nodes, edges, kind } = parseDiagramText(["@startuml", ":第一步;", ":第二步;", "@enduml"].join("\n"));
    expect(kind).toBe("flowchart");
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });

  it("parses PlantUML sequence", () => {
    const { nodes, edges } = parseDiagramText(
      ["@startuml", "participant A", "participant B", "A -> B : hello", "@enduml"].join("\n")
    );
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect((edges[0].data as { label: string }).label).toBe("hello");
  });

  it("throws on unsupported text", () => {
    expect(() => parseDiagramText("just some random words")).toThrow();
  });
});
