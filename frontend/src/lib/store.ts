import { create } from "zustand";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import { defaultEdgeData, defaultNodeData, type ShapeNodeData, type EdgeData } from "./types";
import { uid } from "./id";

export interface DiagramMeta {
  id: string | null;
  name: string;
  description: string;
  saved: boolean;
  saving: boolean;
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

interface EditorState {
  nodes: Node[];
  edges: Edge[];
  meta: DiagramMeta;
  selected: string | null;
  selectedIds: string[];
  past: { nodes: Node[]; edges: Edge[] }[];
  future: { nodes: Node[]; edges: Edge[] }[];

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelected: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
  setMeta: (patch: Partial<DiagramMeta>) => void;

  updateNodeData: (id: string, patch: Partial<ShapeNodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<EdgeData>) => void;
  updateManyNodes: (ids: string[], patch: Partial<ShapeNodeData>) => void;
  updateManyEdges: (ids: string[], patch: Partial<EdgeData>) => void;
  addNode: (node: Node) => void;
  addShapeNode: (shape: ShapeNodeData["shape"], position: { x: number; y: number }) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  alignNodes: (mode: AlignMode) => void;
  distributeNodes: (axis: "horizontal" | "vertical") => void;

  loadDoc: (nodes: Node[], edges: Edge[]) => void;
  clearAll: () => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const MAX_HISTORY = 100;

function nodeWidth(n: Node): number {
  const data = n.data as Partial<ShapeNodeData>;
  if (typeof n.measured?.width === "number" && n.measured.width) return n.measured.width;
  if (typeof n.width === "number" && n.width) return n.width;
  const styleW = n.style?.width;
  if (typeof styleW === "number" && styleW) return styleW;
  return data.width ?? 160;
}

function nodeHeight(n: Node): number {
  const data = n.data as Partial<ShapeNodeData>;
  if (typeof n.measured?.height === "number" && n.measured.height) return n.measured.height;
  if (typeof n.height === "number" && n.height) return n.height;
  const styleH = n.style?.height;
  if (typeof styleH === "number" && styleH) return styleH;
  return data.height ?? 80;
}

export const useEditor = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  meta: { id: null, name: "未命名流程图", description: "", saved: true, saving: false },
  selected: null,
  selectedIds: [],
  past: [],
  future: [],

  setNodes: (nodes) => set({ nodes, meta: { ...get().meta, saved: false } }),
  setEdges: (edges) => set({ edges, meta: { ...get().meta, saved: false } }),

  onNodesChange: (changes) => {
    const { nodes } = get();
    const next = applyNodeChanges(changes, nodes);
    const structural = changes.some(
      (c) =>
        c.type === "remove" ||
        c.type === "add" ||
        c.type === "replace" ||
        (c.type === "position" && c.dragging === false)
    );
    set({ nodes: next });
    if (structural) set({ meta: { ...get().meta, saved: false } });
  },

  onEdgesChange: (changes) => {
    const { edges } = get();
    const next = applyEdgeChanges(changes, edges);
    set({ edges: next });
    if (changes.some((c) => c.type === "remove" || c.type === "add" || c.type === "replace")) {
      set({ meta: { ...get().meta, saved: false } });
    }
  },

  onConnect: (connection) => {
    const { edges, pushHistory } = get();
    pushHistory();
    const edge: Edge = {
      ...connection,
      id: uid("e_"),
      type: "custom",
      data: defaultEdgeData(),
    };
    set({ edges: addEdge(edge, edges), meta: { ...get().meta, saved: false } });
  },

  setSelected: (id) => set({ selected: id, selectedIds: id ? [id] : [] }),

  setSelection: (ids) => set({ selectedIds: ids, selected: ids.length === 1 ? ids[0] : null }),

  setMeta: (patch) => set({ meta: { ...get().meta, ...patch } }),

  updateNodeData: (id, patch) => {
    const { nodes, pushHistory } = get();
    pushHistory();
    set({
      nodes: nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      meta: { ...get().meta, saved: false },
    });
  },

  updateEdgeData: (id, patch) => {
    const { edges, pushHistory } = get();
    pushHistory();
    set({
      edges: edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)),
      meta: { ...get().meta, saved: false },
    });
  },

  updateManyNodes: (ids, patch) => {
    const { nodes, pushHistory } = get();
    if (ids.length === 0) return;
    pushHistory();
    const idSet = new Set(ids);
    set({
      nodes: nodes.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, ...patch } } : n)),
      meta: { ...get().meta, saved: false },
    });
  },

  updateManyEdges: (ids, patch) => {
    const { edges, pushHistory } = get();
    if (ids.length === 0) return;
    pushHistory();
    const idSet = new Set(ids);
    set({
      edges: edges.map((e) => (idSet.has(e.id) ? { ...e, data: { ...e.data, ...patch } } : e)),
      meta: { ...get().meta, saved: false },
    });
  },

  addNode: (node) => {
    const { nodes, pushHistory } = get();
    pushHistory();
    set({ nodes: [...nodes, node], meta: { ...get().meta, saved: false } });
  },

  addShapeNode: (shape, position) => {
    const { addNode } = get();
    const data = defaultNodeData(shape);
    addNode({
      id: uid("n_"),
      type: "shape",
      position,
      data,
      style: { width: data.width, height: data.height },
      selected: true,
    });
  },

  removeSelected: () => {
    const { nodes, edges, selectedIds, pushHistory } = get();
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds);
    set({
      nodes: nodes.filter((n) => !idSet.has(n.id)),
      edges: edges.filter((e) => !idSet.has(e.id) && !idSet.has(e.source) && !idSet.has(e.target)),
      selected: null,
      selectedIds: [],
      meta: { ...get().meta, saved: false },
    });
  },

  duplicateSelected: () => {
    const { nodes, edges, selectedIds, pushHistory } = get();
    const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));
    if (selectedNodes.length === 0) return;
    pushHistory();

    const idMap = new Map<string, string>();
    const clones: Node[] = selectedNodes.map((src) => {
      const id = uid("n_");
      idMap.set(src.id, id);
      return {
        ...src,
        id,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        selected: true,
        data: { ...src.data },
      };
    });

    // Duplicate edges whose both endpoints are part of the selection.
    const edgeClones: Edge[] = edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: uid("e_"),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      }));

    set({
      nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...clones],
      edges: [...edges, ...edgeClones],
      selectedIds: clones.map((c) => c.id),
      selected: clones.length === 1 ? clones[0].id : null,
      meta: { ...get().meta, saved: false },
    });
  },

  alignNodes: (mode) => {
    const { nodes, selectedIds, pushHistory } = get();
    const sel = nodes.filter((n) => selectedIds.includes(n.id));
    if (sel.length < 2) return;
    pushHistory();

    const boxes = sel.map((n) => ({ node: n, w: nodeWidth(n), h: nodeHeight(n) }));
    const minX = Math.min(...boxes.map((b) => b.node.position.x));
    const maxR = Math.max(...boxes.map((b) => b.node.position.x + b.w));
    const minY = Math.min(...boxes.map((b) => b.node.position.y));
    const maxB = Math.max(...boxes.map((b) => b.node.position.y + b.h));
    const cx = (minX + maxR) / 2;
    const cy = (minY + maxB) / 2;

    const positions = new Map<string, { x: number; y: number }>();
    for (const b of boxes) {
      const pos = { ...b.node.position };
      switch (mode) {
        case "left":
          pos.x = minX;
          break;
        case "right":
          pos.x = maxR - b.w;
          break;
        case "hcenter":
          pos.x = cx - b.w / 2;
          break;
        case "top":
          pos.y = minY;
          break;
        case "bottom":
          pos.y = maxB - b.h;
          break;
        case "vcenter":
          pos.y = cy - b.h / 2;
          break;
      }
      positions.set(b.node.id, pos);
    }

    set({
      nodes: nodes.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n)),
      meta: { ...get().meta, saved: false },
    });
  },

  distributeNodes: (axis) => {
    const { nodes, selectedIds, pushHistory } = get();
    const sel = nodes.filter((n) => selectedIds.includes(n.id));
    if (sel.length < 3) return;
    pushHistory();

    const items = sel.map((n) => ({ node: n, w: nodeWidth(n), h: nodeHeight(n) }));
    const positions = new Map<string, { x: number; y: number }>();

    if (axis === "horizontal") {
      items.sort((a, b) => a.node.position.x - b.node.position.x);
      const startCx = items[0].node.position.x + items[0].w / 2;
      const endCx = items[items.length - 1].node.position.x + items[items.length - 1].w / 2;
      const gap = (endCx - startCx) / (items.length - 1);
      items.forEach((it, i) => {
        positions.set(it.node.id, { x: startCx + gap * i - it.w / 2, y: it.node.position.y });
      });
    } else {
      items.sort((a, b) => a.node.position.y - b.node.position.y);
      const startCy = items[0].node.position.y + items[0].h / 2;
      const endCy = items[items.length - 1].node.position.y + items[items.length - 1].h / 2;
      const gap = (endCy - startCy) / (items.length - 1);
      items.forEach((it, i) => {
        positions.set(it.node.id, { x: it.node.position.x, y: startCy + gap * i - it.h / 2 });
      });
    }

    set({
      nodes: nodes.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n)),
      meta: { ...get().meta, saved: false },
    });
  },

  loadDoc: (nodes, edges) => {
    set({
      nodes,
      edges,
      selected: null,
      selectedIds: [],
      past: [],
      future: [],
      meta: { ...get().meta, saved: true },
    });
  },

  clearAll: () => {
    const { pushHistory } = get();
    pushHistory();
    set({ nodes: [], edges: [], selected: null, selectedIds: [], meta: { ...get().meta, saved: false } });
  },

  pushHistory: () => {
    const { nodes, edges, past } = get();
    const nextPast = [...past, { nodes, edges }];
    if (nextPast.length > MAX_HISTORY) nextPast.shift();
    set({ past: nextPast, future: [] });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future],
      nodes: prev.nodes,
      edges: prev.edges,
      selected: null,
      selectedIds: [],
      meta: { ...get().meta, saved: false },
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      future: future.slice(1),
      past: [...past, { nodes, edges }],
      nodes: next.nodes,
      edges: next.edges,
      selected: null,
      selectedIds: [],
      meta: { ...get().meta, saved: false },
    });
  },
}));
