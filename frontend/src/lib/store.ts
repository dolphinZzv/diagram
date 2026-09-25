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
import { defaultEdgeData, defaultNodeData, type ShapeNodeData, type EdgeData, type LineStyle } from "./types";
import { uid } from "./id";
import { defaultShapeLabel, tr } from "./i18n";
import { layoutLayered } from "./layout";
import { layoutMindMap } from "./mindmap";
import { paletteTone } from "./palettes";
import { SEQ_HEIGHT, SEQ_ROWS, SEQ_WIDTH, parseRow, rowHandleId } from "./sequence";

export interface DiagramMeta {
  id: string | null;
  name: string;
  description: string;
  saved: boolean;
  saving: boolean;
  /** Active read-only share token (empty when sharing is off). */
  shareToken: string;
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

interface EditorState {
  nodes: Node[];
  edges: Edge[];
  meta: DiagramMeta;
  selected: string | null;
  selectedIds: string[];
  clipboard: { nodes: Node[]; edges: Edge[] } | null;
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
  copySelected: () => void;
  paste: () => void;
  selectAll: () => void;

  setLocked: (id: string, locked: boolean) => void;
  lockSelected: (locked: boolean) => void;
  setNodeDimensions: (id: string, width: number, height: number) => void;

  groupSelected: () => void;
  ungroupSelected: () => void;

  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;

  alignNodes: (mode: AlignMode) => void;
  distributeNodes: (axis: "horizontal" | "vertical") => void;
  autoLayout: (direction: "TB" | "LR") => void;
  mindMapLayout: (rootId?: string) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  restyleAll: (paletteKey: string) => void;
  addChildNode: (parentId: string) => void;
  addSiblingNode: (nodeId: string) => void;
  addParticipant: () => void;
  addMessage: (sourceId: string, targetId: string, label?: string, lineStyle?: LineStyle) => string | undefined;

  loadDoc: (nodes: Node[], edges: Edge[]) => void;
  clearAll: () => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const MAX_HISTORY = 100;

// Coalesce history entries while the user holds an arrow key.
let lastNudgeAt = 0;

function nodeWidth(n: Node): number {
  const data = n.data as Partial<ShapeNodeData>;
  if (typeof n.measured?.width === "number" && n.measured.width) return n.measured.width;
  if (typeof n.width === "number" && n.width) return n.width;
  const styleW = n.style?.width;
  if (typeof styleW === "number" && styleW) return styleW;
  return data.width ?? 120;
}

function nodeHeight(n: Node): number {
  const data = n.data as Partial<ShapeNodeData>;
  if (typeof n.measured?.height === "number" && n.measured.height) return n.measured.height;
  if (typeof n.height === "number" && n.height) return n.height;
  const styleH = n.style?.height;
  if (typeof styleH === "number" && styleH) return styleH;
  return data.height ?? 60;
}

export const useEditor = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  meta: { id: null, name: "未命名流程图", description: "", saved: true, saving: false, shareToken: "" },
  selected: null,
  selectedIds: [],
  clipboard: null,
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
    // Give new shapes a default, editable label (the localized shape name).
    data.label = defaultShapeLabel(shape);
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
    // Also drop children of removed groups.
    const orphaned = new Set(
      nodes.filter((n) => n.parentId && idSet.has(n.parentId)).map((n) => n.id)
    );
    for (const id of orphaned) idSet.add(id);
    set({
      nodes: nodes.filter((n) => !idSet.has(n.id)),
      edges: edges.filter((e) => !idSet.has(e.id) && !idSet.has(e.source) && !idSet.has(e.target)),
      selected: null,
      selectedIds: [],
      meta: { ...get().meta, saved: false },
    });
  },

  duplicateSelected: () => {
    const { copySelected, paste } = get();
    copySelected();
    paste();
  },

  copySelected: () => {
    const { nodes, edges, selectedIds } = get();
    const sel = new Set(selectedIds);
    const selNodes = nodes.filter((n) => sel.has(n.id));
    if (selNodes.length === 0) return;
    // Include group children so a copied group keeps its contents.
    const groups = new Set(selNodes.filter((n) => n.type === "group").map((n) => n.id));
    const expanded = new Set(selNodes.map((n) => n.id));
    for (const n of nodes) if (n.parentId && groups.has(n.parentId)) expanded.add(n.id);
    const copyNodes = nodes.filter((n) => expanded.has(n.id)).map((n) => ({ ...n }));
    const copyEdges = edges
      .filter((e) => expanded.has(e.source) && expanded.has(e.target))
      .map((e) => ({ ...e }));
    set({ clipboard: { nodes: copyNodes, edges: copyEdges } });
  },

  paste: () => {
    const { clipboard, nodes, edges, pushHistory } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;
    pushHistory();
    const offset = 40;
    const idMap = new Map<string, string>();
    for (const n of clipboard.nodes) {
      idMap.set(n.id, uid(n.type === "group" ? "g_" : "n_"));
    }
    const clones: Node[] = clipboard.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      parentId: n.parentId ? idMap.get(n.parentId) : undefined,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      selected: true,
    }));
    const edgeClones: Edge[] = clipboard.edges.map((e) => ({
      ...e,
      id: uid("e_"),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
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

  selectAll: () => {
    const { nodes, edges } = get();
    set({ selectedIds: [...nodes.map((n) => n.id), ...edges.map((e) => e.id)], selected: null });
  },

  setLocked: (id, locked) => {
    const { nodes, pushHistory } = get();
    pushHistory();
    set({
      nodes: nodes.map((n) =>
        n.id === id
          ? { ...n, draggable: !locked, connectable: !locked, data: { ...n.data, locked } }
          : n
      ),
      meta: { ...get().meta, saved: false },
    });
  },

  lockSelected: (locked) => {
    const { nodes, selectedIds, pushHistory } = get();
    const sel = new Set(selectedIds);
    if (sel.size === 0) return;
    pushHistory();
    set({
      nodes: nodes.map((n) =>
        sel.has(n.id)
          ? { ...n, draggable: !locked, connectable: !locked, data: { ...n.data, locked } }
          : n
      ),
      meta: { ...get().meta, saved: false },
    });
  },

  setNodeDimensions: (id, width, height) => {
    const { nodes } = get();
    set({
      nodes: nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              width,
              height,
              style: { ...n.style, width, height },
              data: { ...n.data, width, height },
            }
          : n
      ),
      meta: { ...get().meta, saved: false },
    });
  },

  groupSelected: () => {
    const { nodes, selectedIds, pushHistory } = get();
    const children = nodes.filter(
      (n) => selectedIds.includes(n.id) && n.type !== "group" && !n.parentId
    );
    if (children.length === 0) return;
    pushHistory();

    const pad = 28;
    const header = 28;
    const minX = Math.min(...children.map((n) => n.position.x));
    const minY = Math.min(...children.map((n) => n.position.y));
    const maxX = Math.max(...children.map((n) => n.position.x + nodeWidth(n)));
    const maxY = Math.max(...children.map((n) => n.position.y + nodeHeight(n)));
    const gx = minX - pad;
    const gy = minY - pad - header;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2 + header;

    const gid = uid("g_");
    const group: Node = {
      id: gid,
      type: "group",
      position: { x: gx, y: gy },
      data: { label: "" },
      style: { width: gw, height: gh },
      zIndex: 0,
      selectable: true,
      draggable: true,
      connectable: false,
      selected: true,
    };
    const childSet = new Set(children.map((n) => n.id));
    const rest = nodes.map((n) =>
      childSet.has(n.id)
        ? {
            ...n,
            parentId: gid,
            extent: "parent" as const,
            position: { x: n.position.x - gx, y: n.position.y - gy },
            selected: false,
          }
        : { ...n, selected: false }
    );
    set({ nodes: [group, ...rest], selectedIds: [gid], selected: gid, meta: { ...get().meta, saved: false } });
  },

  ungroupSelected: () => {
    const { nodes, selectedIds, pushHistory } = get();
    const groups = nodes.filter((n) => selectedIds.includes(n.id) && n.type === "group");
    if (groups.length === 0) return;
    pushHistory();
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const out: Node[] = [];
    for (const n of nodes) {
      if (groupMap.has(n.id)) continue;
      if (n.parentId && groupMap.has(n.parentId)) {
        const g = groupMap.get(n.parentId)!;
        const nn: Node = {
          ...n,
          position: { x: n.position.x + g.position.x, y: n.position.y + g.position.y },
        };
        delete (nn as { parentId?: string }).parentId;
        delete (nn as { extent?: unknown }).extent;
        out.push(nn);
      } else {
        out.push(n);
      }
    }
    set({ nodes: out, selectedIds: [], selected: null, meta: { ...get().meta, saved: false } });
  },

  bringToFront: () => {
    const { nodes, selectedIds, pushHistory } = get();
    const sel = nodes.filter((n) => selectedIds.includes(n.id));
    if (sel.length === 0) return;
    pushHistory();
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
    const ordered = [...sel].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const map = new Map<string, number>();
    ordered.forEach((n, i) => map.set(n.id, maxZ + 1 + i));
    set({ nodes: nodes.map((n) => (map.has(n.id) ? { ...n, zIndex: map.get(n.id) } : n)), meta: { ...get().meta, saved: false } });
  },

  sendToBack: () => {
    const { nodes, selectedIds, pushHistory } = get();
    const sel = nodes.filter((n) => selectedIds.includes(n.id));
    if (sel.length === 0) return;
    pushHistory();
    const minZ = nodes.reduce((m, n) => Math.min(m, n.zIndex ?? 0), 0);
    const ordered = [...sel].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const map = new Map<string, number>();
    ordered.forEach((n, i) => map.set(n.id, minZ - ordered.length + i));
    set({ nodes: nodes.map((n) => (map.has(n.id) ? { ...n, zIndex: map.get(n.id) } : n)), meta: { ...get().meta, saved: false } });
  },

  bringForward: () => {
    const { nodes, selectedIds, pushHistory } = get();
    if (!selectedIds.some((id) => nodes.find((n) => n.id === id))) return;
    pushHistory();
    const sel = new Set(selectedIds);
    set({
      nodes: nodes.map((n) => (sel.has(n.id) ? { ...n, zIndex: (n.zIndex ?? 0) + 1 } : n)),
      meta: { ...get().meta, saved: false },
    });
  },

  sendBackward: () => {
    const { nodes, selectedIds, pushHistory } = get();
    if (!selectedIds.some((id) => nodes.find((n) => n.id === id))) return;
    pushHistory();
    const sel = new Set(selectedIds);
    set({
      nodes: nodes.map((n) => (sel.has(n.id) ? { ...n, zIndex: (n.zIndex ?? 0) - 1 } : n)),
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

  autoLayout: (direction) => {
    const { nodes, edges, pushHistory } = get();
    if (nodes.length === 0) return;
    pushHistory();
    set({ nodes: layoutLayered(nodes, edges, direction), meta: { ...get().meta, saved: false } });
  },

  mindMapLayout: (rootId) => {
    const { nodes, edges, selectedIds, pushHistory } = get();
    if (nodes.length === 0) return;
    pushHistory();
    set({
      nodes: layoutMindMap(nodes, edges, rootId ?? selectedIds[0]),
      meta: { ...get().meta, saved: false },
    });
  },

  nudgeSelected: (dx, dy) => {
    const { nodes, selectedIds } = get();
    const sel = new Set(selectedIds);
    if (sel.size === 0) return;
    const now = Date.now();
    if (now - lastNudgeAt > 600) get().pushHistory();
    lastNudgeAt = now;
    set({
      nodes: nodes.map((n) =>
        sel.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n
      ),
      meta: { ...get().meta, saved: false },
    });
  },

  restyleAll: (paletteKey) => {
    const { nodes, pushHistory } = get();
    if (nodes.length === 0) return;
    pushHistory();
    let i = 0;
    set({
      nodes: nodes.map((n) => {
        if (n.type === "group") return n;
        const tone = paletteTone(paletteKey, i);
        i += 1;
        if (!tone) return n;
        return { ...n, data: { ...n.data, fill: tone.fill, stroke: tone.stroke, textColor: tone.textColor } };
      }),
      meta: { ...get().meta, saved: false },
    });
  },

  addChildNode: (parentId) => {
    const { nodes, edges, pushHistory } = get();
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;
    pushHistory();
    const pw = nodeWidth(parent);
    const ph = nodeHeight(parent);
    const data: ShapeNodeData = {
      ...defaultNodeData("rounded"),
      label: tr("mindmap.child"),
      fill: "#ffffff",
      stroke: "#94a3b8",
      textColor: "#0f172a",
      width: 120,
      height: 56,
    };
    const id = uid("n_");
    const node: Node = {
      id,
      type: "shape",
      position: { x: parent.position.x + pw + 90, y: parent.position.y + ph / 2 - data.height / 2 },
      data,
      style: { width: data.width, height: data.height },
      selected: true,
    };
    const edge: Edge = { id: uid("e_"), source: parentId, target: id, type: "custom", data: defaultEdgeData() };
    set({
      nodes: [...nodes.map((n) => ({ ...n, selected: false })), node],
      edges: [...edges, edge],
      selectedIds: [id],
      selected: id,
      meta: { ...get().meta, saved: false },
    });
  },

  addSiblingNode: (nodeId) => {
    const { nodes, edges, pushHistory } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    pushHistory();
    const parentEdge = edges.find((e) => e.target === nodeId);
    const data: ShapeNodeData = {
      ...defaultNodeData("rounded"),
      label: tr("mindmap.sibling"),
      fill: "#ffffff",
      stroke: "#94a3b8",
      textColor: "#0f172a",
      width: 120,
      height: 56,
    };
    const id = uid("n_");
    const newNode: Node = {
      id,
      type: "shape",
      position: { x: node.position.x, y: node.position.y + nodeHeight(node) + 22 },
      data,
      style: { width: data.width, height: data.height },
      selected: true,
    };
    const edge: Edge = {
      id: uid("e_"),
      source: parentEdge ? parentEdge.source : nodeId,
      target: id,
      type: "custom",
      data: defaultEdgeData(),
    };
    set({
      nodes: [...nodes.map((n) => ({ ...n, selected: false })), newNode],
      edges: [...edges, edge],
      selectedIds: [id],
      selected: id,
      meta: { ...get().meta, saved: false },
    });
  },

  addParticipant: () => {
    const { nodes, pushHistory } = get();
    pushHistory();
    const lifelines = nodes.filter((n) => n.type === "lifeline");
    const gap = 80;
    const x = lifelines.length
      ? Math.max(...lifelines.map((n) => n.position.x)) + SEQ_WIDTH + gap
      : 0;
    const y = lifelines.length ? Math.min(...lifelines.map((n) => n.position.y)) : 0;
    const id = uid("n_");
    const data: ShapeNodeData = {
      ...defaultNodeData("rect"),
      label: `${tr("seq.participant")} ${lifelines.length + 1}`,
      fill: "#ffffff",
      stroke: "#475569",
      textColor: "#0f172a",
      width: SEQ_WIDTH,
      height: SEQ_HEIGHT,
    };
    const node: Node = {
      id,
      type: "lifeline",
      position: { x, y },
      data,
      style: { width: SEQ_WIDTH, height: SEQ_HEIGHT },
      selected: true,
    };
    set({
      nodes: [...nodes.map((n) => ({ ...n, selected: false })), node],
      selectedIds: [id],
      selected: id,
      meta: { ...get().meta, saved: false },
    });
  },

  addMessage: (sourceId, targetId, label, lineStyle) => {
    const { nodes, edges, pushHistory } = get();
    const source = nodes.find((n) => n.id === sourceId);
    const target = nodes.find((n) => n.id === targetId);
    if (!source || !target) return;
    pushHistory();

    // Pick the first unused row.
    const used = new Set<number>();
    for (const e of edges) {
      const row = parseRow(e.sourceHandle);
      if (row !== null) used.add(row);
    }
    let row = 0;
    while (used.has(row) && row < SEQ_ROWS - 1) row += 1;

    const rightward = target.position.x >= source.position.x;
    const edge: Edge = {
      id: uid("e_"),
      source: sourceId,
      target: targetId,
      sourceHandle: rowHandleId(rightward ? "r" : "l", row),
      targetHandle: rowHandleId(rightward ? "l" : "r", row),
      type: "custom",
      data: {
        ...defaultEdgeData(),
        label: label ?? tr("seq.message"),
        pathType: "straight",
        arrowType: "arrowclosed",
        lineStyle: lineStyle ?? "solid",
      },
    };
    set({
      edges: [...edges, edge],
      selectedIds: [edge.id],
      selected: edge.id,
      meta: { ...get().meta, saved: false },
    });
    return edge.id;
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
