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
  | "note"
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
  /** when true the node cannot be moved, resized or connected */
  locked: boolean;
  /** optional lucide icon name rendered inside the node */
  icon?: string;
  /** optional image URL (rendered filling the node) */
  imageUrl?: string;
}

export interface EdgeData extends Record<string, unknown> {
  label: string;
  color: string;
  width: number;
  lineStyle: LineStyle;
  /** arrow at the target end */
  arrowType: ArrowType;
  /** arrow at the source end */
  startArrowType: ArrowType;
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
  note: "便签",
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
  "note",
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
    width: 120,
    height: 60,
    fontSize: 14,
    textColor: "#0f172a",
    opacity: 1,
    radius: 8,
    fontWeight: "normal",
    fontStyle: "normal",
    locked: false,
  };
  if (shape === "ellipse") {
    base.width = 110;
    base.height = 70;
  }
  if (shape === "diamond") {
    base.width = 120;
    base.height = 80;
  }
  if (shape === "triangle") {
    base.width = 110;
    base.height = 90;
  }
  if (shape === "cylinder") {
    base.width = 96;
    base.height = 96;
  }
  if (shape === "document") {
    base.width = 110;
    base.height = 130;
  }
  if (shape === "hexagon") {
    base.width = 130;
    base.height = 70;
  }
  if (shape === "cloud") {
    base.width = 140;
    base.height = 90;
  }
  if (shape === "note") {
    base.fill = "#fef9c3";
    base.stroke = "#eab308";
    base.textColor = "#713f12";
    base.width = 140;
    base.height = 100;
    base.radius = 4;
  }
  if (shape === "star") {
    base.width = 120;
    base.height = 110;
  }
  if (shape === "text") {
    base.fill = "transparent";
    base.stroke = "transparent";
    base.width = 120;
    base.height = 48;
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
    startArrowType: "none",
    pathType: "bezier",
    labelRotation: 0,
    animated: false,
    points: [],
  };
}
