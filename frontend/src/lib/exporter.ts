import { toPng, toSvg } from "html-to-image";
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";

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

export async function exportImage(
  nodes: Node[],
  format: "png" | "svg",
  filename = "diagram",
  scale = 2
): Promise<void> {
  if (nodes.length === 0) throw new Error("画布为空");
  const viewport = getViewportEl();
  const bounds = getNodesBounds(nodes);
  // Add padding to the bounds.
  const padding = 60;
  const width = Math.max(bounds.width + padding * 2, 200);
  const height = Math.max(bounds.height + padding * 2, 200);
  const transform = getViewportForBounds(bounds, width, height, 0.1, 4, padding);

  const options = {
    backgroundColor: "#ffffff",
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
    pixelRatio: format === "png" ? scale : 1,
    skipFonts: false,
  };

  const dataUrl = format === "png" ? await toPng(viewport, options) : await toSvg(viewport, options);
  download(dataUrl, `${filename}.${format}`);
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
