import type { Edge, Node } from "@xyflow/react";
import type { EdgeData, ShapeNodeData } from "./types";
import { parseRow } from "./sequence";

/** Mermaid node ids must be simple identifiers. */
function sid(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function label(text: string, fallback: string): string {
  const v = (text || fallback).replace(/\r?\n/g, " ").replace(/"/g, "&quot;").trim();
  return v || fallback;
}

function shapeSuffix(shape: string, text: string, id: string): string {
  const l = label(text, id);
  switch (shape) {
    case "diamond":
      return `{"${l}"}`;
    case "ellipse":
      return `(("${l}"))`;
    case "cylinder":
      return `[("${l}")]`;
    case "parallelogram":
      return `[/"${l}"/]`;
    case "hexagon":
      return `{{"${l}"}}`;
    case "rounded":
    case "cloud":
      return `("${l}")`;
    default:
      return `["${l}"]`;
  }
}

function edgeArrow(style: EdgeData["lineStyle"] | undefined): string {
  if (style === "dashed" || style === "dotted") return "-.->";
  return "-->";
}

/** Serializes a sequence diagram (lifelines + messages) to Mermaid. */
function toSequence(lifelines: Node[], edges: Edge[]): string {
  const ordered = [...lifelines].sort((a, b) => a.position.x - b.position.x);
  const ids = new Set(ordered.map((n) => sid(n.id)));
  const lines = ["sequenceDiagram"];
  for (const n of ordered) {
    const label = (((n.data as { label?: string })?.label ?? n.id) as string).replace(/\r?\n/g, " ");
    lines.push(`  participant ${sid(n.id)} as ${label}`);
  }
  const messages = edges
    .filter((e) => ids.has(sid(e.source)) && ids.has(sid(e.target)))
    .map((e) => ({ e, row: parseRow(e.sourceHandle) ?? 0 }))
    .sort((a, b) => a.row - b.row);
  for (const { e } of messages) {
    const d = (e.data ?? {}) as EdgeData;
    const arrow = d.lineStyle === "dashed" || d.lineStyle === "dotted" ? "-->>" : "->>";
    const text = d.label ? `: ${d.label.replace(/\r?\n/g, " ")}` : "";
    lines.push(`  ${sid(e.source)}${arrow}${sid(e.target)}${text}`);
  }
  return lines.join("\n") + "\n";
}

/** Serializes the diagram to a Mermaid flowchart (or sequence diagram). */
export function toMermaid(nodes: Node[], edges: Edge[], direction: "TD" | "LR" = "TD"): string {
  const lifelines = nodes.filter((n) => n.type === "lifeline");
  if (lifelines.length > 0) return toSequence(lifelines, edges);

  const lines: string[] = [`flowchart ${direction}`];
  const visible = nodes.filter((n) => n.type !== "group");
  const ids = new Set(visible.map((n) => sid(n.id)));

  for (const n of visible) {
    const d = n.data as ShapeNodeData;
    lines.push(`  ${sid(n.id)}${shapeSuffix(d.shape, d.label, n.id)}`);
  }

  for (const e of edges) {
    if (!ids.has(sid(e.source)) || !ids.has(sid(e.target))) continue;
    const d = (e.data ?? {}) as EdgeData;
    const arrow = edgeArrow(d.lineStyle);
    const labelPart = d.label ? `|${label(d.label, "")}|` : "";
    lines.push(`  ${sid(e.source)} ${arrow}${labelPart} ${sid(e.target)}`);
  }

  return lines.join("\n") + "\n";
}
