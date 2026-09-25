import type { Edge, Node } from "@xyflow/react";
import { defaultEdgeData, defaultNodeData, type LineStyle, type ShapeType } from "./types";
import { layoutLayered } from "./layout";
import { SEQ_HEIGHT, SEQ_WIDTH, rowHandleId } from "./sequence";
import { uid } from "./id";

export interface ParsedDiagram {
  nodes: Node[];
  edges: Edge[];
  kind: "flowchart" | "sequence";
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

// ---------------- Mermaid flowchart ----------------

function parseNodeSpec(spec: string): { id: string; shape: ShapeType; label: string; explicit: boolean } {
  const m = spec.trim().match(/^([\w-]+)\s*([\s\S]*)$/);
  if (!m) return { id: spec.trim(), shape: "rect", label: spec.trim(), explicit: false };
  const id = m[1];
  const rest = (m[2] ?? "").trim();
  if (!rest) return { id, shape: "rect", label: id, explicit: false };

  const patterns: { re: RegExp; shape: ShapeType }[] = [
    { re: /^\(\((.*)\)\)$/, shape: "ellipse" },
    { re: /^\[\((.*)\)\]$/, shape: "cylinder" },
    { re: /^\{\{(.*)\}\}$/, shape: "hexagon" },
    { re: /^\[\/(.*)\/\]$/, shape: "parallelogram" },
    { re: /^\((.*)\)$/, shape: "rounded" },
    { re: /^\{(.*)\}$/, shape: "diamond" },
    { re: /^\[(.*)\]$/, shape: "rect" },
  ];
  for (const p of patterns) {
    const mm = rest.match(p.re);
    if (mm) return { id, shape: p.shape, label: stripQuotes(mm[1]) || id, explicit: true };
  }
  return { id, shape: "rect", label: stripQuotes(rest) || id, explicit: true };
}

function makeShapeNode(
  id: string,
  shape: ShapeType,
  label: string,
  position: { x: number; y: number }
): Node {
  const data = { ...defaultNodeData(shape), label };
  return {
    id,
    type: "shape",
    position,
    data,
    style: { width: data.width, height: data.height },
  };
}

function parseMermaidFlowchart(text: string): ParsedDiagram {
  const dirMatch = text.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/im);
  const direction: "TB" | "LR" = dirMatch && (dirMatch[1] === "LR" || dirMatch[1] === "RL") ? "LR" : "TB";

  const body = text
    .replace(/^(?:flowchart|graph)\s+\w+/im, "")
    .replace(/%%[^\n]*/g, "");

  const statements = body
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  const specs = new Map<string, { shape: ShapeType; label: string; explicit: boolean }>();
  const setSpec = (s: { id: string; shape: ShapeType; label: string; explicit: boolean }) => {
    const cur = specs.get(s.id);
    // Prefer an explicit definition over a bare id reference.
    if (!cur || s.explicit || !cur.explicit) {
      specs.set(s.id, { shape: s.shape, label: s.label, explicit: s.explicit });
    }
  };
  const rawEdges: { source: string; target: string; label: string; dashed: boolean }[] = [];

  const edgeRe = /^(.+?)\s*(-->|-\.->|==>|---|--x|--o)\s*(?:\|([^|]*)\|)?\s*(.+?)\s*$/;

  for (const stmt of statements) {
    const em = stmt.match(edgeRe);
    if (em) {
      // target may itself carry `|label|`
      let label = em[3] ?? "";
      let targetSpec = em[4];
      const lm = targetSpec.match(/^\|([^|]*)\|\s*(.+)$/);
      if (lm) {
        label = lm[1];
        targetSpec = lm[2];
      }
      const src = parseNodeSpec(em[1]);
      const tgt = parseNodeSpec(targetSpec);
      setSpec(src);
      setSpec(tgt);
      rawEdges.push({
        source: src.id,
        target: tgt.id,
        label: stripQuotes(label),
        dashed: em[2] === "-.->",
      });
      continue;
    }
    const n = parseNodeSpec(stmt);
    setSpec(n);
  }

  const nodes: Node[] = [...specs.entries()].map(([id, v]) => makeShapeNode(id, v.shape, v.label, { x: 0, y: 0 }));
  const edges: Edge[] = rawEdges.map((e) => ({
    id: uid("e_"),
    source: e.source,
    target: e.target,
    type: "custom",
    data: {
      ...defaultEdgeData(),
      label: e.label,
      lineStyle: (e.dashed ? "dashed" : "solid") as LineStyle,
    },
  }));

  return { nodes: layoutLayered(nodes, edges, direction), edges, kind: "flowchart" };
}

// ---------------- Mermaid sequenceDiagram ----------------

function parseMermaidSequence(text: string): ParsedDiagram {
  const lines = text.split("\n").map((l) => l.trim());
  const order: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  const messages: { source: string; target: string; label: string; dashed: boolean }[] = [];

  const ensure = (id: string, label?: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push({ id, label: label ?? id });
    }
  };

  for (const line of lines) {
    if (!line || /^sequenceDiagram$/i.test(line) || line.startsWith("%%")) continue;
    const p = line.match(/^(?:participant|actor)\s+([\w-]+)(?:\s+as\s+(.+))?$/i);
    if (p) {
      ensure(p[1], stripQuotes(p[2] ?? p[1]));
      continue;
    }
    const m = line.match(/^([\w-]+)\s*(-{1,2}>>|->>|-->>|->|-->)\s*([\w-]+)\s*:\s*(.*)$/);
    if (m) {
      ensure(m[1]);
      ensure(m[3]);
      messages.push({
        source: m[1],
        target: m[3],
        label: stripQuotes(m[4]),
        dashed: m[2].startsWith("--"),
      });
    }
  }

  const nodes: Node[] = order.map((p, i) => {
    const data = {
      ...defaultNodeData("rect"),
      label: p.label,
      width: SEQ_WIDTH,
      height: SEQ_HEIGHT,
    };
    return {
      id: p.id,
      type: "lifeline",
      position: { x: i * (SEQ_WIDTH + 80), y: 0 },
      data,
      style: { width: SEQ_WIDTH, height: SEQ_HEIGHT },
    };
  });

  const indexOf = new Map(order.map((p, i) => [p.id, i]));
  const edges: Edge[] = messages.map((msg) => {
    const rightward = (indexOf.get(msg.target) ?? 0) >= (indexOf.get(msg.source) ?? 0);
    return {
      id: uid("e_"),
      source: msg.source,
      target: msg.target,
      sourceHandle: rowHandleId(rightward ? "r" : "l", 0),
      targetHandle: rowHandleId(rightward ? "l" : "r", 0),
      type: "custom",
      data: {
        ...defaultEdgeData(),
        label: msg.label,
        pathType: "straight",
        lineStyle: (msg.dashed ? "dashed" : "solid") as LineStyle,
      },
    };
  });

  // Place messages on successive rows.
  const usedRows = new Map<string, number>();
  let row = 0;
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    const r = usedRows.get(key) ?? row++;
    usedRows.set(key, r);
    const rightward = (indexOf.get(e.target) ?? 0) >= (indexOf.get(e.source) ?? 0);
    e.sourceHandle = rowHandleId(rightward ? "r" : "l", r);
    e.targetHandle = rowHandleId(rightward ? "l" : "r", r);
  }

  return { nodes, edges, kind: "sequence" };
}

// ---------------- PlantUML ----------------

function parsePlantUml(text: string): ParsedDiagram {
  const isSequence = /@startuml/i.test(text) && /(?:participant|actor)\s+/i.test(text);
  if (isSequence) {
    const lines = text.split("\n").map((l) => l.trim());
    const order: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    const messages: { source: string; target: string; label: string; dashed: boolean }[] = [];
    const ensure = (id: string, label?: string) => {
      if (!seen.has(id)) {
        seen.add(id);
        order.push({ id, label: label ?? id });
      }
    };
    for (const line of lines) {
      if (!line || line.startsWith("@") || line.startsWith("'")) continue;
      const p = line.match(/^(?:participant|actor)\s+(?:"([^"]+)"\s+as\s+)?([\w-]+)(?:\s+as\s+(.+))?$/i);
      if (p) {
        ensure(p[2], stripQuotes(p[3] ?? p[1] ?? p[2]));
        continue;
      }
      const m = line.match(/^([\w-]+)\s*(-->|->|-->>|->>)\s*([\w-]+)\s*(?::\s*(.*))?$/);
      if (m) {
        ensure(m[1]);
        ensure(m[3]);
        messages.push({ source: m[1], target: m[3], label: stripQuotes(m[4] ?? ""), dashed: m[2].startsWith("--") });
      }
    }
    const nodes: Node[] = order.map((p, i) => {
      const data = { ...defaultNodeData("rect"), label: p.label, width: SEQ_WIDTH, height: SEQ_HEIGHT };
      return {
        id: p.id,
        type: "lifeline",
        position: { x: i * (SEQ_WIDTH + 80), y: 0 },
        data,
        style: { width: SEQ_WIDTH, height: SEQ_HEIGHT },
      };
    });
    const edges: Edge[] = [];
    let row = 0;
    const idx = new Map(order.map((p, i) => [p.id, i]));
    for (const msg of messages) {
      const rightward = (idx.get(msg.target) ?? 0) >= (idx.get(msg.source) ?? 0);
      edges.push({
        id: uid("e_"),
        source: msg.source,
        target: msg.target,
        sourceHandle: rowHandleId(rightward ? "r" : "l", row),
        targetHandle: rowHandleId(rightward ? "l" : "r", row),
        type: "custom",
        data: {
          ...defaultEdgeData(),
          label: msg.label,
          pathType: "straight",
          lineStyle: (msg.dashed ? "dashed" : "solid") as LineStyle,
        },
      });
      row += 1;
    }
    return { nodes, edges, kind: "sequence" };
  }

  // PlantUML activity: :step; statements
  const steps = [...text.matchAll(/^\s*:(.+?);\s*$/gm)].map((m) => m[1].trim());
  if (steps.length > 0) {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    steps.forEach((label, i) => {
      const id = `s${i + 1}`;
      nodes.push(makeShapeNode(id, "rounded", label, { x: 0, y: 0 }));
      if (i > 0) {
        edges.push({
          id: uid("e_"),
          source: `s${i}`,
          target: id,
          type: "custom",
          data: { ...defaultEdgeData() },
        });
      }
    });
    return { nodes: layoutLayered(nodes, edges, "TB"), edges, kind: "flowchart" };
  }

  throw new Error("Unsupported PlantUML input");
}

// ---------------- entry point ----------------

/** Parses Mermaid (flowchart / sequenceDiagram) or PlantUML text. */
export function parseDiagramText(input: string): ParsedDiagram {
  const text = input.trim();
  if (!text) throw new Error("Empty input");

  if (/^sequenceDiagram/i.test(text)) return parseMermaidSequence(text);
  if (/^(?:flowchart|graph)\b/i.test(text)) return parseMermaidFlowchart(text);

  if (/@startuml/i.test(text)) return parsePlantUml(text);

  // Bare sequence-ish text
  if (/\w+\s*->>?\s*\w+\s*:/.test(text)) return parseMermaidSequence("sequenceDiagram\n" + text);

  // Bare flowchart-ish text
  if (/-->|-\.->|==>/.test(text)) return parseMermaidFlowchart("flowchart TD\n" + text);

  throw new Error("Unrecognized diagram text (expected Mermaid or PlantUML)");
}
