import { renderToStaticMarkup } from "react-dom/server";
import {
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type Node,
} from "@xyflow/react";
import { Shape } from "@/components/editor/Shape";
import { dashArray, polyline, smoothPathThrough, type Pt } from "./geometry";
import type { EdgeData, ShapeNodeData, SubgraphNodeData } from "./types";
import { canvasColors, type Theme } from "./theme";

function nodeSize(n: Node): { w: number; h: number } {
  const d = n.data as Partial<ShapeNodeData>;
  const w =
    (typeof n.measured?.width === "number" && n.measured.width) ||
    (typeof n.width === "number" && n.width) ||
    (typeof n.style?.width === "number" && n.style.width) ||
    d.width ||
    120;
  const h =
    (typeof n.measured?.height === "number" && n.measured.height) ||
    (typeof n.height === "number" && n.height) ||
    (typeof n.style?.height === "number" && n.style.height) ||
    d.height ||
    60;
  return { w, h };
}

function sideFromHandle(id: string | null | undefined, fallback: Position): Position {
  switch (id) {
    case "t":
      return Position.Top;
    case "r":
      return Position.Right;
    case "b":
      return Position.Bottom;
    case "l":
      return Position.Left;
    default:
      return fallback;
  }
}

function handlePoint(n: Node, side: Position): Pt {
  const { w, h } = nodeSize(n);
  const { x, y } = n.position;
  switch (side) {
    case Position.Top:
      return { x: x + w / 2, y };
    case Position.Right:
      return { x: x + w, y: y + h / 2 };
    case Position.Bottom:
      return { x: x + w / 2, y: y + h };
    default:
      return { x, y: y + h / 2 };
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough width of a character at a given font size (CJK is wider). */
function charWidth(ch: string, fontSize: number): number {
  return /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.58;
}

function wrapText(label: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of label.split("\n")) {
    let line = "";
    let width = 0;
    for (const ch of paragraph) {
      const cw = charWidth(ch, fontSize);
      if (width + cw > maxWidth && line) {
        lines.push(line);
        line = ch;
        width = cw;
      } else {
        line += ch;
        width += cw;
      }
    }
    lines.push(line);
  }
  return lines;
}

function markerPath(type: EdgeData["arrowType"]): { path: string; size: number } | null {
  switch (type) {
    case "arrowclosed":
      return { path: "M0,0 L10,4 L0,8 z", size: 10 };
    case "arrow":
      return { path: "M0,0 L10,4 L0,8", size: 10 };
    case "diamond":
      return { path: "M0,4 L5,0 L10,4 L5,8 z", size: 10 };
    default:
      return null;
  }
}

function nodeMarkup(node: Node): string {
  if (node.type === "subgraph") {
    const d = node.data as unknown as SubgraphNodeData;
    const { w, h } = nodeSize(node);
    const stroke = escapeXml(String(d.stroke ?? "#94a3b8"));
    const fill = escapeXml(String(d.fill ?? "#f8fafc"));
    const color = escapeXml(String(d.textColor ?? "#0f172a"));
    const opacity = Number(d.opacity ?? 1);
    return (
      `<g transform="translate(${node.position.x},${node.position.y})" opacity="${opacity}">` +
      `<rect x="0" y="0" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-dasharray="6 4"/>` +
      `<text x="12" y="24" font-size="13" font-weight="bold" fill="${color}">${escapeXml(d.label || "")}</text>` +
      `</g>`
    );
  }
  const data = node.data as ShapeNodeData;
  const { w, h } = nodeSize(node);
  const shape = renderToStaticMarkup(
    <Shape
      shape={data.shape}
      width={w}
      height={h}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      radius={data.radius}
    />
  );

  let text = "";
  if (data.label) {
    const fontSize = Number(data.fontSize) || 14;
    const lines = wrapText(data.label, Math.max(w - 12, 20), fontSize);
    const lineHeight = fontSize * 1.25;
    const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    const weight = data.fontWeight === "bold" ? "bold" : "normal";
    const style = data.fontStyle === "italic" ? "italic" : "normal";
    const tspans = lines
      .map(
        (ln, i) =>
          `<tspan x="${w / 2}" y="${startY + i * lineHeight + fontSize * 0.35}">${escapeXml(ln)}</tspan>`
      )
      .join("");
    // Attribute values are escaped: they come from (possibly untrusted) diagram
    // data and must not be able to break out of the attribute or inject elements.
    text = `<text text-anchor="middle" font-size="${fontSize}" font-weight="${weight}" font-style="${style}" fill="${escapeXml(String(data.textColor ?? "#0f172a"))}">${tspans}</text>`;
  }

  const rot = Number(data.rotation) || 0;
  const transform = `translate(${node.position.x},${node.position.y}) rotate(${rot},${w / 2},${h / 2})`;
  const opacity = Number(data.opacity ?? 1);
  return `<g transform="${transform}" opacity="${opacity}">${shape}${text}</g>`;
}

function edgeMarkup(edge: Edge, src: Node, tgt: Node, idx: number): string {
  const data = (edge.data ?? {}) as EdgeData;
  const sourceSide = sideFromHandle(edge.sourceHandle, Position.Bottom);
  const targetSide = sideFromHandle(edge.targetHandle, Position.Top);
  const s = handlePoint(src, sourceSide);
  const tg = handlePoint(tgt, targetSide);
  const points = data.points ?? [];

  let d = "";
  let labelAt = { x: (s.x + tg.x) / 2, y: (s.y + tg.y) / 2 };
  if (points.length > 0) {
    const chain: Pt[] = [s, ...points, tg];
    d = data.pathType === "straight" ? polyline(chain) : smoothPathThrough(chain);
    const mid = Math.floor(chain.length / 2);
    const a = chain[mid - 1] ?? chain[0];
    const b = chain[mid] ?? chain[chain.length - 1];
    labelAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  } else if (data.pathType === "straight") {
    const [p, lx, ly] = getStraightPath({ sourceX: s.x, sourceY: s.y, targetX: tg.x, targetY: tg.y });
    d = p;
    labelAt = { x: lx, y: ly };
  } else if (data.pathType === "step" || data.pathType === "smoothstep") {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX: s.x,
      sourceY: s.y,
      targetX: tg.x,
      targetY: tg.y,
      sourcePosition: sourceSide,
      targetPosition: targetSide,
      borderRadius: data.pathType === "step" ? 0 : 8,
    });
    d = p;
    labelAt = { x: lx, y: ly };
  } else {
    const [p, lx, ly] = getBezierPath({
      sourceX: s.x,
      sourceY: s.y,
      targetX: tg.x,
      targetY: tg.y,
      sourcePosition: sourceSide,
      targetPosition: targetSide,
    });
    d = p;
    labelAt = { x: lx, y: ly };
  }

  const color = String(data.color ?? "#475569");
  const color2 = escapeXml(color);
  const width = Number(data.width ?? 2);
  const dash = dashArray(data.lineStyle ?? "solid");

  const endMarker = markerPath(data.arrowType ?? "arrowclosed");
  const startMarker = markerPath(data.startArrowType ?? "none");
  const endId = `arw-e${idx}`;
  const startId = `arw-s${idx}`;

  let defs = "";
  if (endMarker) {
    const fill = data.arrowType === "arrow" ? "none" : color2;
    defs += `<marker id="${endId}" markerWidth="${endMarker.size}" markerHeight="${endMarker.size}" refX="${endMarker.size - 1}" refY="${endMarker.size / 2}" orient="auto-start-reverse" viewBox="0 0 ${endMarker.size} ${endMarker.size}" markerUnits="userSpaceOnUse"><path d="${endMarker.path}" fill="${fill}" stroke="${color2}" stroke-width="1.5"/></marker>`;
  }
  if (startMarker) {
    const fill = data.startArrowType === "arrow" ? "none" : color2;
    defs += `<marker id="${startId}" markerWidth="${startMarker.size}" markerHeight="${startMarker.size}" refX="1" refY="${startMarker.size / 2}" orient="auto-start-reverse" viewBox="0 0 ${startMarker.size} ${startMarker.size}" markerUnits="userSpaceOnUse"><path d="${startMarker.path}" fill="${fill}" stroke="${color2}" stroke-width="1.5"/></marker>`;
  }

  const markerStart = startMarker ? ` marker-start="url(#${startId})"` : "";
  const markerEnd = endMarker ? ` marker-end="url(#${endId})"` : "";
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const path = `<path d="${escapeXml(d)}" fill="none" stroke="${color2}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}${markerStart}${markerEnd}/>`;

  let label = "";
  if (data.label) {
    const rot = Number(data.labelRotation) || 0;
    label = `<text x="${labelAt.x}" y="${labelAt.y}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="${color2}" transform="rotate(${rot},${labelAt.x},${labelAt.y})">${escapeXml(data.label)}</text>`;
  }

  return defs ? `<g>${defs}${path}${label}</g>` : `<g>${path}${label}</g>`;
}

export interface SvgExportOptions {
  theme?: Theme;
  padding?: number;
  background?: string;
}

/** Builds a self-contained, foreignObject-free SVG string for the diagram. */
export function diagramToSvg(nodes: Node[], edges: Edge[], opts: SvgExportOptions = {}): string {
  const theme = opts.theme ?? "light";
  const padding = opts.padding ?? 40;
  const bg = opts.background ?? canvasColors(theme).exportBg;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const n of nodes) {
    const { w, h } = nodeSize(n);
    consider(n.position.x, n.position.y);
    consider(n.position.x + w, n.position.y + h);
  }
  for (const e of edges) {
    const pts = ((e.data as EdgeData | undefined)?.points ?? []) as Pt[];
    for (const p of pts) consider(p.x, p.y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 100;
  }

  const x = minX - padding;
  const y = minY - padding;
  const w = Math.max(maxX - minX + padding * 2, 1);
  const h = Math.max(maxY - minY + padding * 2, 1);

  const edgeSvg = edges
    .map((e, i) => {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      if (!src || !tgt) return "";
      return edgeMarkup(e, src, tgt, i);
    })
    .join("");

  const nodeSvg = nodes.map((n) => nodeMarkup(n)).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" ` +
    `viewBox="${x} ${y} ${w} ${h}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>` +
    `<g>${edgeSvg}</g>` +
    `<g>${nodeSvg}</g>` +
    `</svg>`
  );
}
