import { toPng, toSvg } from "html-to-image";
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { canvasColors, type Theme } from "./theme";

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function getViewportEl(): HTMLElement {
  const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!el) throw new Error("viewport not found");
  return el;
}

/** Renders the current canvas to a data URL (does not download). */
export async function renderImage(
  nodes: Node[],
  format: "png" | "svg",
  theme: Theme = "light",
  scale = 2
): Promise<string> {
  if (nodes.length === 0) throw new Error("empty canvas");
  const viewport = getViewportEl();
  const bounds = getNodesBounds(nodes);
  const padding = 60;
  const width = Math.max(bounds.width + padding * 2, 200);
  const height = Math.max(bounds.height + padding * 2, 200);
  const transform = getViewportForBounds(bounds, width, height, 0.1, 4, padding);

  const options = {
    backgroundColor: canvasColors(theme).exportBg,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
    pixelRatio: format === "png" ? scale : 1,
  };

  return format === "png" ? toPng(viewport, options) : toSvg(viewport, options);
}

export async function exportImage(
  nodes: Node[],
  format: "png" | "svg",
  filename = "diagram",
  theme: Theme = "light",
  scale = 2
): Promise<void> {
  const dataUrl = await renderImage(nodes, format, theme, scale);
  download(dataUrl, `${filename}.${format}`);
}

/** Converts a data URL to a Blob (used for uploading share images). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function exportJSON(data: unknown, filename = "diagram") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, `${filename}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
