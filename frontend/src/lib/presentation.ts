import type { Edge, Node } from "@xyflow/react";

/**
 * Presentation order: a topological ordering (so arrows are followed), with
 * ties broken by position (top-to-bottom, left-to-right).
 */
export function presentationOrder(nodes: Node[], edges: Edge[]): string[] {
  const ids = new Set(nodes.filter((n) => n.type !== "group" && n.type !== "lane").map((n) => n.id));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  ids.forEach((id) => {
    indeg.set(id, 0);
    adj.set(id, []);
  });
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const posOf = (id: string) => nodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 };
  const cmp = (a: string, b: string) => {
    const pa = posOf(a);
    const pb = posOf(b);
    return pa.y - pb.y || pa.x - pb.x;
  };
  const queue = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0).sort(cmp);
  const out: string[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const nx of adj.get(id) ?? []) {
      indeg.set(nx, (indeg.get(nx) ?? 1) - 1);
      if ((indeg.get(nx) ?? 0) <= 0) queue.push(nx);
    }
    queue.sort(cmp);
  }
  for (const id of [...ids].sort(cmp)) if (!seen.has(id)) out.push(id);
  return out;
}
