import type { Edge, Node } from "@xyflow/react";

export type LayoutDirection = "TB" | "LR";

function size(n: Node): { w: number; h: number } {
  const d = n.data as { width?: number; height?: number };
  const w =
    (typeof n.measured?.width === "number" && n.measured.width) ||
    (typeof n.width === "number" && n.width) ||
    (typeof n.style?.width === "number" && n.style.width) ||
    d?.width ||
    120;
  const h =
    (typeof n.measured?.height === "number" && n.measured.height) ||
    (typeof n.height === "number" && n.height) ||
    (typeof n.style?.height === "number" && n.style.height) ||
    d?.height ||
    60;
  return { w, h };
}

/**
 * A simple layered (Sugiyama-style) layout: nodes are assigned to layers by
 * longest-path from the sources, then spread along the cross axis and centred.
 * Group children keep their relative offsets.
 */
export function layoutLayered(nodes: Node[], edges: Edge[], direction: LayoutDirection = "TB"): Node[] {
  const top = nodes.filter((n) => !n.parentId);
  if (top.length === 0) return nodes;

  const ids = new Set(top.map((n) => n.id));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of top) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  // Longest-path layering.
  const layer = new Map<string, number>();
  const remaining = new Map(indeg);
  const queue: string[] = [];
  for (const [id, deg] of indeg) {
    if (deg === 0) {
      queue.push(id);
      layer.set(id, 0);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of adj.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(id) ?? 0) + 1));
      remaining.set(next, (remaining.get(next) ?? 1) - 1);
      if ((remaining.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  for (const n of top) if (!layer.has(n.id)) layer.set(n.id, 0);

  const byLayer = new Map<number, Node[]>();
  for (const n of top) {
    const l = layer.get(n.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n);
  }
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);

  const nodeSizes = new Map(top.map((n) => [n.id, size(n)]));
  const crossGap = 60;
  const layerGap = 120;
  const positions = new Map<string, { x: number; y: number }>();

  let mainPos = 0;
  for (const l of layerKeys) {
    const items = byLayer.get(l)!;
    const vertical = direction === "TB";
    const mainExtent = Math.max(...items.map((n) => (vertical ? nodeSizes.get(n.id)!.h : nodeSizes.get(n.id)!.w)));
    const totalCross =
      items.reduce((sum, n) => sum + (vertical ? nodeSizes.get(n.id)!.w : nodeSizes.get(n.id)!.h), 0) +
      crossGap * (items.length - 1);

    let cursor = -totalCross / 2;
    for (const n of items) {
      const s = nodeSizes.get(n.id)!;
      if (vertical) {
        positions.set(n.id, { x: cursor, y: mainPos });
        cursor += s.w + crossGap;
      } else {
        positions.set(n.id, { x: mainPos, y: cursor });
        cursor += s.h + crossGap;
      }
    }
    mainPos += mainExtent + layerGap;
  }

  return nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, position: p } : n;
  });
}
