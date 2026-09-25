import type { ShapeNodeData } from "./types";

export type NodeStyle = Pick<
  ShapeNodeData,
  | "fill"
  | "stroke"
  | "strokeWidth"
  | "radius"
  | "textColor"
  | "fontSize"
  | "fontWeight"
  | "fontStyle"
  | "opacity"
>;

export interface StylePreset {
  nameKey: string;
  fill: string;
  stroke: string;
  textColor: string;
  strokeWidth: number;
  radius: number;
  fontSize: number;
}

export const STYLE_PRESETS: StylePreset[] = [
  { nameKey: "preset.plain", fill: "#ffffff", stroke: "#475569", textColor: "#0f172a", strokeWidth: 2, radius: 8, fontSize: 14 },
  { nameKey: "preset.soft", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", strokeWidth: 2, radius: 10, fontSize: 14 },
  { nameKey: "preset.success", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", strokeWidth: 2, radius: 10, fontSize: 14 },
  { nameKey: "preset.warn", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", strokeWidth: 2, radius: 10, fontSize: 14 },
  { nameKey: "preset.danger", fill: "#fee2e2", stroke: "#dc2626", textColor: "#991b1b", strokeWidth: 2, radius: 10, fontSize: 14 },
  { nameKey: "preset.purple", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", strokeWidth: 2, radius: 10, fontSize: 14 },
  { nameKey: "preset.dark", fill: "#1e293b", stroke: "#0f172a", textColor: "#f8fafc", strokeWidth: 2, radius: 8, fontSize: 14 },
  { nameKey: "preset.outline", fill: "transparent", stroke: "#0f172a", textColor: "#0f172a", strokeWidth: 2, radius: 8, fontSize: 14 },
];

export function presetStyle(preset: StylePreset): NodeStyle {
  return {
    fill: preset.fill,
    stroke: preset.stroke,
    textColor: preset.textColor,
    strokeWidth: preset.strokeWidth,
    radius: preset.radius,
    fontSize: preset.fontSize,
    fontWeight: "normal",
    fontStyle: "normal",
    opacity: 1,
  };
}
