import type { Edge, Node } from "@xyflow/react";
import { diagramToSvg } from "./svgExport";
import type { Theme } from "./theme";

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/** Renders the diagram to a self-contained vector SVG string. */
export function renderSvg(nodes: Node[], edges: Edge[], theme: Theme = "light"): string {
  if (nodes.length === 0) throw new Error("empty canvas");
  return diagramToSvg(nodes, edges, { theme });
}

/** Rasterises an SVG string to a PNG blob via canvas. */
export function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgBlob(svg));
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(Math.round(w * scale), 1);
        canvas.height = Math.max(Math.round(h * scale), 1);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas 2d context unavailable");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error("canvas.toBlob failed"));
          },
          "image/png"
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("failed to load svg"));
    };
    img.src = url;
  });
}

export function exportSVG(nodes: Node[], edges: Edge[], filename = "diagram", theme: Theme = "light"): void {
  const svg = renderSvg(nodes, edges, theme);
  const url = URL.createObjectURL(svgBlob(svg));
  download(url, `${filename}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPNG(
  nodes: Node[],
  edges: Edge[],
  filename = "diagram",
  theme: Theme = "light",
  scale = 2
): Promise<void> {
  const svg = renderSvg(nodes, edges, theme);
  const blob = await svgToPngBlob(svg, scale);
  const url = URL.createObjectURL(blob);
  download(url, `${filename}.png`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(data: unknown, filename = "diagram") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, `${filename}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads arbitrary text (e.g. Mermaid source). */
export function exportText(text: string, filename: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMermaid(text: string, filename = "diagram") {
  exportText(text, `${filename}.mmd`, "text/plain;charset=utf-8");
}

export function readJSONFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
