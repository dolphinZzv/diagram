import type { Edge, Node } from "@xyflow/react";

export type SyncOp =
  | { k: "node" | "edge"; id: string; v: Record<string, unknown> | null }
  | { k: "meta"; name: string };

/** Node/edge payloads synced over the wire (volatile UI state stripped). */
export function syncNode(n: Node): Record<string, unknown> {
  const { measured: _m, selected: _s, dragging: _d, ...rest } = n as unknown as Record<string, unknown>;
  return rest;
}
export function syncEdge(e: Edge): Record<string, unknown> {
  const { selected: _s, ...rest } = e as unknown as Record<string, unknown>;
  return rest;
}

/**
 * Operations that have not been acknowledged by the server yet. Ops are kept
 * here until a send succeeds, so a disconnect (or a reload mid-session) never
 * loses local edits - they are replayed once the socket is back.
 */
export const syncPending = new Map<string, SyncOp>();

/** Seeds the pending queue with a whole document (used when restoring a draft). */
export function seedPendingFromDoc(nodes: Node[], edges: Edge[], name: string): void {
  syncPending.clear();
  for (const n of nodes) syncPending.set(`node:${n.id}`, { k: "node", id: n.id, v: syncNode(n) });
  for (const e of edges) syncPending.set(`edge:${e.id}`, { k: "edge", id: e.id, v: syncEdge(e) });
  if (name) syncPending.set("meta", { k: "meta", name });
}
