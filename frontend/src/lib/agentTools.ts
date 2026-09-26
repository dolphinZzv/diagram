import type { Edge, Node } from "@xyflow/react";
import { useEditor } from "./store";
import { defaultNodeData, type EdgeData, type ShapeType } from "./types";
import { uid } from "./id";
import { toMermaid } from "./mermaid";
import { TEMPLATES } from "./templates";

/**
 * Tools an in-browser agent (WebMCP, a browser extension, the console, ...) can
 * call to drive the editor. They operate on the local editor store, so every
 * mutation goes through the normal history stack and can be undone by the user.
 */

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

const SHAPES: ShapeType[] = [
  "rect", "rounded", "ellipse", "diamond", "hexagon", "triangle",
  "parallelogram", "cylinder", "document", "star", "cloud", "text",
];

function s(args: Record<string, unknown>, k: string): string | undefined {
  return typeof args[k] === "string" ? (args[k] as string) : undefined;
}
function n(args: Record<string, unknown>, k: string): number | undefined {
  return typeof args[k] === "number" && Number.isFinite(args[k]) ? (args[k] as number) : undefined;
}
function arr(args: Record<string, unknown>, k: string): string[] {
  const v = args[k];
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function obj(args: Record<string, unknown>, k: string): Record<string, unknown> {
  const v = args[k];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function nodeSummary(n: Node) {
  const d = n.data as Record<string, unknown>;
  return {
    id: n.id,
    type: n.type ?? "shape",
    shape: d.shape,
    label: d.label,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    width: d.width,
    height: d.height,
    diagramId: d.diagramId,
  };
}

function edgeSummary(e: Edge) {
  const d = (e.data ?? {}) as EdgeData;
  return { id: e.id, source: e.source, target: e.target, label: d.label };
}

export const agentTools: AgentTool[] = [
  {
    name: "diagram_get_state",
    description:
      "Return the current diagram: name, nodes (id/shape/label/position) and edges. Call this first to learn the existing ids.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const s = useEditor.getState();
      return {
        name: s.meta.name,
        documentId: s.meta.id,
        nodes: s.nodes.map(nodeSummary),
        edges: s.edges.map(edgeSummary),
        selected: s.selectedIds,
      };
    },
  },
  {
    name: "diagram_add_node",
    description: "Add a shape node at (x, y). Returns the new node id.",
    inputSchema: {
      type: "object",
      properties: {
        shape: { type: "string", enum: SHAPES },
        label: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        fill: { type: "string" },
        stroke: { type: "string" },
        textColor: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["x", "y"],
    },
    execute: (args) => {
      const shape = (s(args, "shape") ?? "rect") as ShapeType;
      const data = defaultNodeData(SHAPES.includes(shape) ? shape : "rect");
      if (s(args, "label") !== undefined) data.label = s(args, "label")!;
      for (const key of ["fill", "stroke", "textColor"] as const) {
        const v = s(args, key);
        if (v) data[key] = v;
      }
      for (const key of ["width", "height"] as const) {
        const v = n(args, key);
        if (v) data[key] = v;
      }
      const node: Node = {
        id: uid("n_"),
        type: "shape",
        position: { x: n(args, "x") ?? 0, y: n(args, "y") ?? 0 },
        data,
        style: { width: data.width, height: data.height },
      };
      useEditor.getState().addNode(node);
      return { nodeId: node.id };
    },
  },
  {
    name: "diagram_update_node",
    description: "Merge fields into a node's data (label, fill, stroke, textColor, width, height, rotation, shape, opacity, locked).",
    inputSchema: {
      type: "object",
      properties: { nodeId: { type: "string" }, patch: { type: "object" } },
      required: ["nodeId", "patch"],
    },
    execute: (args) => {
      const id = s(args, "nodeId");
      if (!id) throw new Error("nodeId is required");
      useEditor.getState().updateNodeData(id, obj(args, "patch"));
      return { ok: true };
    },
  },
  {
    name: "diagram_remove_nodes",
    description: "Remove nodes by id (connected edges are removed too).",
    inputSchema: { type: "object", properties: { nodeIds: { type: "array", items: { type: "string" } } }, required: ["nodeIds"] },
    execute: (args) => {
      const ids = arr(args, "nodeIds");
      const store = useEditor.getState();
      store.setSelection(ids);
      store.removeSelected();
      return { removed: ids.length };
    },
  },
  {
    name: "diagram_add_edge",
    description: "Connect two nodes. Handles: t (top), r (right), b (bottom), l (left).",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        target: { type: "string" },
        sourceHandle: { type: "string" },
        targetHandle: { type: "string" },
        label: { type: "string" },
        color: { type: "string" },
        pathType: { type: "string", enum: ["bezier", "straight", "step", "smoothstep"] },
        arrowType: { type: "string", enum: ["arrowclosed", "arrow", "diamond", "none"] },
        lineStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
        animated: { type: "boolean" },
      },
      required: ["source", "target"],
    },
    execute: (args) => {
      const source = s(args, "source");
      const target = s(args, "target");
      if (!source || !target) throw new Error("source and target are required");
      const before = new Set(useEditor.getState().edges.map((e) => e.id));
      useEditor.getState().onConnect({
        source,
        target,
        sourceHandle: s(args, "sourceHandle") ?? null,
        targetHandle: s(args, "targetHandle") ?? null,
      });
      const created = useEditor.getState().edges.find((e) => !before.has(e.id));
      if (!created) throw new Error("could not create edge (source/target not found?)");
      const patch: Record<string, unknown> = {};
      for (const key of ["label", "color", "pathType", "arrowType", "lineStyle"] as const) {
        const v = s(args, key);
        if (v) patch[key] = v;
      }
      if (typeof args.animated === "boolean") patch.animated = args.animated;
      if (Object.keys(patch).length) useEditor.getState().updateEdgeData(created.id, patch);
      return { edgeId: created.id };
    },
  },
  {
    name: "diagram_remove_edges",
    description: "Remove edges by id.",
    inputSchema: { type: "object", properties: { edgeIds: { type: "array", items: { type: "string" } } }, required: ["edgeIds"] },
    execute: (args) => {
      const ids = arr(args, "edgeIds");
      const store = useEditor.getState();
      store.setSelection(ids);
      store.removeSelected();
      return { removed: ids.length };
    },
  },
  {
    name: "diagram_select",
    description: "Select nodes/edges by id (empty array clears the selection).",
    inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
    execute: (args) => {
      useEditor.getState().setSelection(arr(args, "ids"));
      return { ok: true };
    },
  },
  {
    name: "diagram_set_name",
    description: "Rename the current diagram.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    execute: (args) => {
      const name = s(args, "name");
      if (!name) throw new Error("name is required");
      useEditor.getState().setMeta({ name, saved: false });
      return { ok: true };
    },
  },
  {
    name: "diagram_auto_layout",
    description: "Auto-arrange nodes in layers.",
    inputSchema: { type: "object", properties: { direction: { type: "string", enum: ["TB", "LR"] } } },
    execute: (args) => {
      useEditor.getState().autoLayout((s(args, "direction") === "LR" ? "LR" : "TB") as "TB" | "LR");
      return { ok: true };
    },
  },
  {
    name: "diagram_undo",
    description: "Undo the last change.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      useEditor.getState().undo();
      return { ok: true };
    },
  },
  {
    name: "diagram_export_mermaid",
    description: "Export the current diagram as Mermaid text.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const s = useEditor.getState();
      return { mermaid: toMermaid(s.nodes, s.edges) };
    },
  },
  {
    name: "diagram_list_templates",
    description: "List built-in templates (id + name).",
    inputSchema: { type: "object", properties: {} },
    execute: () => ({ templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name })) }),
  },
];

/** Runs a tool by name. Used by the WebMCP bridge and the window fallback. */
export async function callAgentTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const tool = agentTools.find((t) => t.name === name);
  if (!tool) throw new Error(`unknown tool: ${name}`);
  return await tool.execute(args);
}
