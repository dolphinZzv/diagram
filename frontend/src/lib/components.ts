import { create } from "zustand";
import type { Edge, Node } from "@xyflow/react";
import { uid } from "./id";
import { api, type ServerComponent } from "./api";

export const DEFAULT_CATEGORY = "未分类";

export interface ComponentDef {
  id: string;
  name: string;
  category: string;
  kind: "single" | "compound";
  nodes: Node[];
  edges: Edge[];
  createdAt: number;
}

const KEY = "diagram_components_v1";

function load(): ComponentDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ComponentDef[]) : [];
  } catch {
    return [];
  }
}

function persist(list: ComponentDef[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / disabled storage */
  }
}

interface ComponentState {
  components: ComponentDef[];
  syncStatus: "idle" | "syncing" | "error";
  add: (c: ComponentDef) => void;
  update: (id: string, patch: Partial<ComponentDef>) => void;
  remove: (id: string) => void;
  replaceAll: (list: ComponentDef[]) => void;
  syncFromServer: () => Promise<void>;
}

function toServer(c: ComponentDef) {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    kind: c.kind,
    data: { nodes: c.nodes, edges: c.edges },
  };
}

function fromServer(r: ServerComponent): ComponentDef {
  return {
    id: r.id,
    name: r.name,
    category: r.category || DEFAULT_CATEGORY,
    kind: r.kind === "compound" ? "compound" : "single",
    nodes: (r.data?.nodes ?? []) as Node[],
    edges: (r.data?.edges ?? []) as Edge[],
    createdAt: Date.parse(r.createdAt) || Date.now(),
  };
}

export const useComponents = create<ComponentState>((set, get) => ({
  components: load(),
  syncStatus: "idle",
  add: (c) => {
    const list = [...get().components, c];
    persist(list);
    set({ components: list });
    void api.upsertComponent(toServer(c)).catch(() => undefined);
  },
  update: (id, patch) => {
    const list = get().components.map((c) => (c.id === id ? { ...c, ...patch } : c));
    persist(list);
    set({ components: list });
    const updated = list.find((c) => c.id === id);
    if (updated) void api.updateComponent(id, toServer(updated)).catch(() => undefined);
  },
  remove: (id) => {
    const list = get().components.filter((c) => c.id !== id);
    persist(list);
    set({ components: list });
    void api.deleteComponent(id).catch(() => undefined);
  },
  replaceAll: (list) => {
    persist(list);
    set({ components: list });
  },
  syncFromServer: async () => {
    set({ syncStatus: "syncing" });
    try {
      const remote = await api.listComponents();
      const remoteIds = new Set(remote.map((r) => r.id));
      const localOnly = get().components.filter((c) => !remoteIds.has(c.id));
      const list = [...remote.map(fromServer), ...localOnly];
      persist(list);
      set({ components: list, syncStatus: "idle" });
      // Upload components that only exist locally.
      await Promise.all(
        localOnly.map((c) => api.upsertComponent(toServer(c)).catch(() => undefined))
      );
    } catch {
      set({ syncStatus: "error" });
    }
  },
}));

/** Distinct categories, with the default first. */
export function categoriesOf(components: ComponentDef[]): string[] {
  const set = new Set<string>();
  for (const c of components) if (c.category) set.add(c.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Bounding box of a component's nodes (used for centred insertion). */
export function componentBounds(component: ComponentDef): { minX: number; minY: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of component.nodes) {
    const data = n.data as { width?: number; height?: number };
    const w = (n.style?.width as number) || data.width || 120;
    const h = (n.style?.height as number) || data.height || 60;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, w: 0, h: 0 };
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Builds a component from the current selection. Nodes are cloned; top-level
 * positions are re-based so the fragment origin is (0, 0). Children of selected
 * groups/lanes are included automatically.
 */
export function buildComponentFromSelection(
  nodes: Node[],
  edges: Edge[],
  selectedIds: string[],
  name: string,
  category: string
): ComponentDef | null {
  const sel = new Set(selectedIds);
  const selNodes = nodes.filter((n) => sel.has(n.id));
  if (selNodes.length === 0) return null;

  const containers = new Set(
    selNodes.filter((n) => n.type === "group" || n.type === "lane").map((n) => n.id)
  );
  const expanded = new Set(selNodes.map((n) => n.id));
  for (const n of nodes) if (n.parentId && containers.has(n.parentId)) expanded.add(n.id);

  const fragNodes = nodes
    .filter((n) => expanded.has(n.id))
    .map((n) => ({ ...n, selected: false, data: { ...n.data } }));
  const fragEdges = edges
    .filter((e) => expanded.has(e.source) && expanded.has(e.target))
    .map((e) => ({ ...e, selected: false, data: { ...e.data } }));

  const top = fragNodes.filter((n) => !n.parentId);
  const minX = top.length ? Math.min(...top.map((n) => n.position.x)) : 0;
  const minY = top.length ? Math.min(...top.map((n) => n.position.y)) : 0;
  const rebalanced = fragNodes.map((n) =>
    n.parentId ? n : { ...n, position: { x: n.position.x - minX, y: n.position.y - minY } }
  );

  return {
    id: uid("c_"),
    name: name.trim() || "Component",
    category: category.trim() || DEFAULT_CATEGORY,
    kind: fragNodes.length === 1 ? "single" : "compound",
    nodes: rebalanced,
    edges: fragEdges,
    createdAt: Date.now(),
  };
}

export function componentsToJSON(list: ComponentDef[]): string {
  return JSON.stringify({ version: 1, type: "diagram-components", components: list }, null, 2);
}

/** Parses an exported component library, tolerating missing ids/metrics. */
export function parseComponentsJSON(raw: unknown): ComponentDef[] {
  const obj = raw as { components?: unknown } | null;
  const arr = Array.isArray(obj) ? obj : obj && Array.isArray(obj.components) ? obj.components : null;
  if (!arr) throw new Error("Invalid component library file");
  const out: ComponentDef[] = [];
  for (const item of arr) {
    const c = item as Partial<ComponentDef>;
    if (!c || !Array.isArray(c.nodes)) continue;
    out.push({
      id: c.id ?? uid("c_"),
      name: c.name ?? "Component",
      category: c.category ?? DEFAULT_CATEGORY,
      kind: c.kind === "compound" || (c.nodes?.length ?? 0) > 1 ? "compound" : "single",
      nodes: c.nodes as Node[],
      edges: Array.isArray(c.edges) ? (c.edges as Edge[]) : [],
      createdAt: c.createdAt ?? Date.now(),
    });
  }
  if (out.length === 0) throw new Error("No components found");
  return out;
}
