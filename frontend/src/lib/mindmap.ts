import type { Edge, Node } from "@xyflow/react";

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
 * Mind-map layout: the root sits in the centre, its children split evenly to
 * the right and left, and every subtree is stacked and vertically centred on
 * its parent.
 */
export function layoutMindMap(nodes: Node[], edges: Edge[], rootId?: string): Node[] {
  const top = nodes.filter((n) => !n.parentId);
  const byId = new Map(top.map((n) => [n.id, n]));
  if (byId.size === 0) return nodes;

  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    if (hasParent.has(e.target)) continue; // keep it a tree
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
    hasParent.add(e.target);
  }

  const root =
    rootId && byId.has(rootId)
      ? rootId
      : (top.find((n) => !hasParent.has(n.id))?.id ?? top[0].id);

  const hGap = 90;
  const vGap = 22;
  const heightMemo = new Map<string, number>();
  const computing = new Set<string>();

  const subtreeHeight = (id: string): number => {
    const memo = heightMemo.get(id);
    if (memo !== undefined) return memo;
    if (computing.has(id)) return size(byId.get(id)!).h;
    computing.add(id);
    const s = size(byId.get(id)!);
    const kids = children.get(id) ?? [];
    let h = s.h;
    if (kids.length > 0) {
      const total = kids.reduce((sum, k) => sum + subtreeHeight(k), 0) + vGap * (kids.length - 1);
      h = Math.max(s.h, total);
    }
    computing.delete(id);
    heightMemo.set(id, h);
    return h;
  };

  const positions = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  const placeSubtree = (id: string, attachX: number, centerY: number, dir: 1 | -1) => {
    if (placed.has(id)) return;
    placed.add(id);
    const s = size(byId.get(id)!);
    const x = dir > 0 ? attachX : attachX - s.w;
    positions.set(id, { x, y: centerY - s.h / 2 });

    const kids = (children.get(id) ?? []).filter((k) => !placed.has(k));
    if (kids.length === 0) return;
    const total = kids.reduce((sum, k) => sum + subtreeHeight(k), 0) + vGap * (kids.length - 1);
    const childAttach = dir > 0 ? x + s.w + hGap : x - hGap;
    let cursor = centerY - total / 2;
    for (const k of kids) {
      const kh = subtreeHeight(k);
      placeSubtree(k, childAttach, cursor + kh / 2, dir);
      cursor += kh + vGap;
    }
  };

  const rootSize = size(byId.get(root)!);
  positions.set(root, { x: 0, y: -rootSize.h / 2 });
  placed.add(root);

  const rootKids = (children.get(root) ?? []).filter((k) => !placed.has(k));
  const right: string[] = [];
  const left: string[] = [];
  rootKids.forEach((k, i) => (i % 2 === 0 ? right : left).push(k));

  const placeSide = (group: string[], dir: 1 | -1) => {
    if (group.length === 0) return;
    const total = group.reduce((sum, k) => sum + subtreeHeight(k), 0) + vGap * (group.length - 1);
    const attach = dir > 0 ? rootSize.w + hGap : -hGap;
    let cursor = -total / 2;
    for (const k of group) {
      const kh = subtreeHeight(k);
      placeSubtree(k, attach, cursor + kh / 2, dir);
      cursor += kh + vGap;
    }
  };
  placeSide(right, 1);
  placeSide(left, -1);

  return nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, position: p } : n;
  });
}
