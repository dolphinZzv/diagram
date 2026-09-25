import type { Edge, Node } from "@xyflow/react";
import { defaultEdgeData, defaultNodeData, type ShapeNodeData } from "./types";

export interface DiagramFile {
  version: number;
  type: "diagram";
  name?: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

export function serializeDoc(
  nodes: Node[],
  edges: Edge[],
  name: string,
  description = "",
  viewport?: { x: number; y: number; zoom: number }
): DiagramFile {
  return { version: 1, type: "diagram", name, description, nodes, edges, viewport };
}

export function normalizeNodes(raw: unknown[]): Node[] {
  return (raw ?? []).map((n) => {
    const node = n as Partial<Node> & { data?: Partial<ShapeNodeData> };
    const shape = (node.data?.shape ?? "rect") as ShapeNodeData["shape"];
    const data = { ...defaultNodeData(shape), ...(node.data ?? {}) };
    return {
      ...node,
      id: node.id ?? `n_${crypto.randomUUID().slice(0, 8)}`,
      type: "shape",
      position: node.position ?? { x: 0, y: 0 },
      data,
      style: { width: data.width, height: data.height, ...(node.style ?? {}) },
    } as Node;
  });
}

export function normalizeEdges(raw: unknown[]): Edge[] {
  return (raw ?? []).map((e) => {
    const edge = e as Partial<Edge>;
    return {
      ...edge,
      id: edge.id ?? `e_${crypto.randomUUID().slice(0, 8)}`,
      type: "custom",
      data: { ...defaultEdgeData(), ...(edge.data ?? {}) },
    } as Edge;
  });
}

export function parseDiagramFile(input: unknown): DiagramFile {
  const obj = input as Record<string, unknown>;
  if (!obj || typeof obj !== "object") throw new Error("文件格式不正确");
  const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  const edges = Array.isArray(obj.edges) ? obj.edges : [];
  return {
    version: Number(obj.version) || 1,
    type: "diagram",
    name: typeof obj.name === "string" ? obj.name : undefined,
    description: typeof obj.description === "string" ? obj.description : undefined,
    nodes: normalizeNodes(nodes),
    edges: normalizeEdges(edges),
    viewport: obj.viewport as DiagramFile["viewport"],
  };
}
