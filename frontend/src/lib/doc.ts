import type { Edge, Node } from "@xyflow/react";
import { defaultEdgeData, defaultNodeData, type ShapeNodeData } from "./types";
import { uid } from "./id";

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
  const list = (raw ?? []).map((n) => {
    const node = n as Partial<Node> & { data?: Record<string, unknown> };
    const id = node.id ?? uid("n_");
    const position = node.position ?? { x: 0, y: 0 };

    if (node.type === "group" || node.type === "lane") {
      return {
        ...node,
        id,
        type: node.type,
        position,
        data: { label: (node.data?.label as string) ?? "" },
        style: node.style ?? {},
        connectable: false,
      } as Node;
    }

    if (node.type === "lifeline") {
      const d = node.data as Partial<ShapeNodeData> | undefined;
      const data = { ...defaultNodeData("rect"), ...(d ?? {}) };
      return {
        ...node,
        id,
        type: "lifeline",
        position,
        data,
        style: { width: data.width, height: data.height, ...(node.style ?? {}) },
      } as Node;
    }

    const shapeData = node.data as Partial<ShapeNodeData> | undefined;
    const shape = (shapeData?.shape ?? "rect") as ShapeNodeData["shape"];
    const data = { ...defaultNodeData(shape), ...(shapeData ?? {}) };
    return {
      ...node,
      id,
      type: "shape",
      position,
      data,
      style: { width: data.width, height: data.height, ...(node.style ?? {}) },
    } as Node;
  });

  // React Flow requires parent (group) nodes to appear before their children.
  const order = new Map(list.map((n, i) => [n.id, i]));
  return list.sort((a, b) => {
    const ag = a.type === "group" || a.type === "lane" ? 0 : 1;
    const bg = b.type === "group" || b.type === "lane" ? 0 : 1;
    if (ag !== bg) return ag - bg;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
}

export function normalizeEdges(raw: unknown[]): Edge[] {
  return (raw ?? []).map((e) => {
    const edge = e as Partial<Edge>;
    return {
      ...edge,
      id: edge.id ?? uid("e_"),
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
