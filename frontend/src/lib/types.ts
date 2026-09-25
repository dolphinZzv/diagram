export type ShapeType =
  | "rect"
  | "rounded"
  | "ellipse"
  | "diamond"
  | "hexagon"
  | "triangle"
  | "parallelogram"
  | "cylinder"
  | "document"
  | "star"
  | "cloud"
  | "text";

export type LineStyle = "solid" | "dashed" | "dotted";
export type PathType = "bezier" | "straight" | "step" | "smoothstep";
export type ArrowType = "arrowclosed" | "arrow" | "none" | "diamond";

export interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  shape: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number;
  width: number;
  height: number;
  fontSize: number;
  textColor: string;
  opacity: number;
  radius: number;
  fontWeight: string;
  fontStyle: string;
}

export interface EdgeData extends Record<string, unknown> {
  label: string;
  color: string;
  width: number;
  lineStyle: LineStyle;
  arrowType: ArrowType;
  pathType: PathType;
  labelRotation: number;
  animated: boolean;
  /** intermediate waypoints in flow coordinates */
  points: { x: number; y: number }[];
}

export interface DiagramDoc {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
}

export const SHAPE_LABELS: Record<ShapeType, string> = {
  rect: "矩形",
  rounded: "圆角矩形",
  ellipse: "椭圆",
  diamond: "菱形",
  hexagon: "六边形",
  triangle: "三角形",
  parallelogram: "平行四边形",
  cylinder: "圆柱/数据库",
  document: "文档",
  star: "星形",
  cloud: "云",
  text: "文本",
};

export const SHAPE_LIST: ShapeType[] = [
  "rect",
  "rounded",
  "ellipse",
  "diamond",
  "hexagon",
  "triangle",
  "parallelogram",
  "cylinder",
  "document",
  "star",
  "cloud",
  "text",
];

export function defaultNodeData(shape: ShapeType = "rect"): ShapeNodeData {
  const base: ShapeNodeData = {
    label: shape === "text" ? "文本" : "",
    shape,
    fill: "#ffffff",
    stroke: "#475569",
    strokeWidth: 2,
    rotation: 0,
    width: 160,
    height: 80,
    fontSize: 14,
    textColor: "#0f172a",
    opacity: 1,
    radius: 8,
    fontWeight: "normal",
    fontStyle: "normal",
  };
  if (shape === "ellipse") {
    base.width = 140;
    base.height = 90;
  }
  if (shape === "diamond") {
    base.width = 140;
    base.height = 100;
  }
  if (shape === "triangle") {
    base.width = 140;
    base.height = 110;
  }
  if (shape === "cylinder") {
    base.width = 120;
    base.height = 120;
  }
  if (shape === "document") {
    base.width = 140;
    base.height = 170;
  }
  if (shape === "hexagon") {
    base.width = 160;
    base.height = 90;
  }
  if (shape === "cloud") {
    base.width = 180;
    base.height = 110;
  }
  if (shape === "star") {
    base.width = 160;
    base.height = 150;
  }
  if (shape === "text") {
    base.fill = "transparent";
    base.stroke = "transparent";
    base.width = 160;
    base.height = 60;
  }
  return base;
}

export function defaultEdgeData(): EdgeData {
  return {
    label: "",
    color: "#475569",
    width: 2,
    lineStyle: "solid",
    arrowType: "arrowclosed",
    pathType: "bezier",
    labelRotation: 0,
    animated: false,
    points: [],
  };
}
