import type { Edge, Node } from "@xyflow/react";
import { api } from "./api";
import { renderSvg, svgToPngBlob } from "./exporter";
import type { Theme } from "./theme";

/**
 * Renders the diagram and uploads the SVG + PNG used by the direct image share
 * links. Called when publishing so the images always match the published
 * version.
 */
export async function uploadShareImages(
  id: string,
  nodes: Node[],
  edges: Edge[],
  theme: Theme
): Promise<void> {
  if (nodes.length === 0) return;
  const svg = renderSvg(nodes, edges, theme);
  await api.uploadShareImage(id, "svg", new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const png = await svgToPngBlob(svg, 2);
  await api.uploadShareImage(id, "png", png);
}
