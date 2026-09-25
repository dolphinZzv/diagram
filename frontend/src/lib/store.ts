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

export interface DiagramMeta {
  id: string | null;
  name: string;
  description: string;
  saved: boolean;
  saving: boolean;
}

interface EditorState {
  nodes: Node[];
  edges: Edge[];
  meta: DiagramMeta;
  selected: string | null;
  past: { nodes: Node[]; edges: Edge[] }[];
  future: { nodes: Node[]; edges: Edge[] }[];

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelected: (id: string | null) => void;
  setMeta: (patch: Partial<DiagramMeta>) => void;

  updateNodeData: (id: string, patch: Partial<ShapeNodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<EdgeData>) => void;
  addNode: (node: Node) => void;
  addShapeNode: (shape: ShapeNodeData["shape"], position: { x: number; y: number }) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;

  loadDoc: (nodes: Node[], edges: Edge[]) => void;
  clearAll: () => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const MAX_HISTORY = 100;

export const useEditor = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  meta: { id: null, name: "未命名流程图", description: "", saved: true, saving: false },
  selected: null,
  past: [],
  future: [],

  setNodes: (nodes) => set({ nodes, meta: { ...get().meta, saved: false } }),
  setEdges: (edges) => set({ edges, meta: { ...get().meta, saved: false } }),

  onNodesChange: (changes) => {
    const { nodes } = get();
    const next = applyNodeChanges(changes, nodes);
    const structural = changes.some(
      (c) =>
        (c.type === "remove" || c.type === "add" || c.type === "replace") ||
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
      id: `e_${crypto.randomUUID().slice(0, 8)}`,
      type: "custom",
      data: defaultEdgeData(),
    };
    set({ edges: addEdge(edge, edges), meta: { ...get().meta, saved: false } });
  },

  setSelected: (selected) => set({ selected }),

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

  addNode: (node) => {
    const { nodes, pushHistory } = get();
    pushHistory();
    set({ nodes: [...nodes, node], meta: { ...get().meta, saved: false } });
  },

  addShapeNode: (shape, position) => {
    const { addNode } = get();
    const data = defaultNodeData(shape);
    addNode({
      id: `n_${crypto.randomUUID().slice(0, 8)}`,
      type: "shape",
      position,
      data,
      style: { width: data.width, height: data.height },
      selected: true,
    });
  },

  removeSelected: () => {
    const { nodes, edges, selected, pushHistory } = get();
    if (!selected) return;
    pushHistory();
    set({
      nodes: nodes.filter((n) => n.id !== selected),
      edges: edges.filter((e) => e.source !== selected && e.target !== selected),
      selected: null,
      meta: { ...get().meta, saved: false },
    });
  },

  duplicateSelected: () => {
    const { nodes, selected, pushHistory } = get();
    if (!selected) return;
    const src = nodes.find((n) => n.id === selected);
    if (!src) return;
    pushHistory();
    const id = `n_${crypto.randomUUID().slice(0, 8)}`;
    const copy: Node = {
      ...src,
      id,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      selected: true,
      data: { ...src.data },
    };
    set({ nodes: [...nodes, copy], selected: id, meta: { ...get().meta, saved: false } });
  },

  loadDoc: (nodes, edges) => {
    set({
      nodes,
      edges,
      selected: null,
      past: [],
      future: [],
      meta: { ...get().meta, saved: true },
    });
  },

  clearAll: () => {
    const { pushHistory } = get();
    pushHistory();
    set({ nodes: [], edges: [], selected: null, meta: { ...get().meta, saved: false } });
  },

  pushHistory: () => {
    const { nodes, edges, past } = get();
    const snapshot = { nodes, edges };
    const nextPast = [...past, snapshot];
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
      meta: { ...get().meta, saved: false },
    });
  },
}));
