import type { Edge, Node } from "@xyflow/react";
import { defaultEdgeData, defaultNodeData, type EdgeData, type ShapeNodeData, type ShapeType } from "./types";

interface NodeOpts {
  shape?: ShapeType;
  label?: string;
  fill?: string;
  stroke?: string;
  textColor?: string;
  width?: number;
  height?: number;
  fontSize?: number;
}

function node(id: string, x: number, y: number, opts: NodeOpts = {}): Node {
  const base = defaultNodeData(opts.shape ?? "rect");
  const data: ShapeNodeData = {
    ...base,
    ...opts,
  } as ShapeNodeData;
  return {
    id,
    type: "shape",
    position: { x, y },
    data,
    style: { width: data.width, height: data.height },
  };
}

interface EdgeOpts {
  label?: string;
  color?: string;
  pathType?: EdgeData["pathType"];
  lineStyle?: EdgeData["lineStyle"];
  arrowType?: EdgeData["arrowType"];
  startArrowType?: EdgeData["startArrowType"];
  animated?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
}

function edge(id: string, source: string, target: string, opts: EdgeOpts = {}): Edge {
  const { sourceHandle, targetHandle, ...data } = opts;
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: "custom",
    data: { ...defaultEdgeData(), ...data },
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  build: () => { nodes: Node[]; edges: Edge[] };
}

export const TEMPLATES: Template[] = [
  {
    id: "flowchart",
    name: "基础流程图",
    description: "开始 / 处理 / 判断 / 结束",
    build: () => ({
      nodes: [
        node("t-start", 0, 0, { shape: "rounded", label: "开始", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 140, height: 56 }),
        node("t-input", 0, 140, { shape: "rect", label: "输入数据", fill: "#ffffff", stroke: "#475569", width: 160, height: 72 }),
        node("t-check", 0, 300, { shape: "diamond", label: "校验通过?", fill: "#fef9c3", stroke: "#ca8a04", textColor: "#854d0e", width: 160, height: 110 }),
        node("t-ok", -220, 500, { shape: "rect", label: "处理业务", fill: "#dbeafe", stroke: "#2563eb", textColor: "#1e40af", width: 160, height: 72 }),
        node("t-fail", 220, 500, { shape: "rect", label: "返回错误", fill: "#fee2e2", stroke: "#dc2626", textColor: "#991b1b", width: 160, height: 72 }),
        node("t-end", -220, 680, { shape: "rounded", label: "结束", fill: "#f1f5f9", stroke: "#475569", width: 140, height: 56 }),
      ],
      edges: [
        edge("te-1", "t-start", "t-input", { sourceHandle: "b", targetHandle: "t", arrowType: "arrowclosed" }),
        edge("te-2", "t-input", "t-check", { sourceHandle: "b", targetHandle: "t", arrowType: "arrowclosed" }),
        edge("te-3", "t-check", "t-ok", { sourceHandle: "l", targetHandle: "r", label: "是", color: "#16a34a", arrowType: "arrowclosed" }),
        edge("te-4", "t-check", "t-fail", { sourceHandle: "r", targetHandle: "l", label: "否", color: "#dc2626", arrowType: "arrowclosed" }),
        edge("te-5", "t-ok", "t-end", { sourceHandle: "b", targetHandle: "t", arrowType: "arrowclosed" }),
        edge("te-6", "t-fail", "t-end", { sourceHandle: "l", targetHandle: "r", lineStyle: "dashed", arrowType: "arrowclosed" }),
      ],
    }),
  },
  {
    id: "microservice",
    name: "微服务架构",
    description: "客户端 / 网关 / 服务 / 存储",
    build: () => ({
      nodes: [
        node("m-client", -420, 60, { shape: "rounded", label: "客户端", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", width: 130, height: 64 }),
        node("m-cdn", -420, 220, { shape: "cloud", label: "CDN", fill: "#f3e8ff", stroke: "#9333ea", textColor: "#6b21a8", width: 150, height: 100 }),
        node("m-gw", -140, 130, { shape: "hexagon", label: "API 网关", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", width: 170, height: 90 }),
        node("m-svc-a", 160, 20, { shape: "rounded", label: "用户服务", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 150, height: 70 }),
        node("m-svc-b", 160, 150, { shape: "rounded", label: "订单服务", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 150, height: 70 }),
        node("m-mq", 160, 290, { shape: "parallelogram", label: "消息队列", fill: "#fce7f3", stroke: "#db2777", textColor: "#9d174d", width: 160, height: 70 }),
        node("m-db", 430, 20, { shape: "cylinder", label: "数据库", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 120, height: 120 }),
        node("m-cache", 430, 190, { shape: "ellipse", label: "缓存", fill: "#fee2e2", stroke: "#dc2626", textColor: "#991b1b", width: 130, height: 90 }),
        node("m-oss", 430, 330, { shape: "cylinder", label: "对象存储", fill: "#e0e7ff", stroke: "#4f46e5", textColor: "#3730a3", width: 120, height: 120 }),
      ],
      edges: [
        edge("me-1", "m-client", "m-gw", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-2", "m-client", "m-cdn", { sourceHandle: "b", targetHandle: "t", lineStyle: "dashed" }),
        edge("me-3", "m-gw", "m-svc-a", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-4", "m-gw", "m-svc-b", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-5", "m-svc-a", "m-db", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-6", "m-svc-b", "m-cache", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-7", "m-svc-b", "m-mq", { sourceHandle: "b", targetHandle: "t" }),
        edge("me-8", "m-mq", "m-oss", { sourceHandle: "r", targetHandle: "l", lineStyle: "dashed", animated: true }),
      ],
    }),
  },
  {
    id: "pipeline",
    name: "数据管道",
    description: "采集 / 转换 / 队列 / 存储",
    build: () => ({
      nodes: [
        node("p-src", -300, 100, { shape: "cylinder", label: "数据源", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", width: 120, height: 120 }),
        node("p-etl", -60, 120, { shape: "rect", label: "转换 ETL", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 160, height: 80 }),
        node("p-q", 180, 120, { shape: "parallelogram", label: "Kafka", fill: "#fce7f3", stroke: "#db2777", textColor: "#9d174d", width: 150, height: 80 }),
        node("p-dw", 420, 100, { shape: "cylinder", label: "数据仓库", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 120, height: 120 }),
        node("p-bi", 420, 300, { shape: "rounded", label: "BI 报表", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", width: 140, height: 66 }),
      ],
      edges: [
        edge("pe-1", "p-src", "p-etl", { sourceHandle: "r", targetHandle: "l" }),
        edge("pe-2", "p-etl", "p-q", { sourceHandle: "r", targetHandle: "l" }),
        edge("pe-3", "p-q", "p-dw", { sourceHandle: "r", targetHandle: "l", animated: true }),
        edge("pe-4", "p-dw", "p-bi", { sourceHandle: "b", targetHandle: "t" }),
      ],
    }),
  },
  {
    id: "mindmap",
    name: "思维导图",
    description: "中心主题 + 多级分支",
    build: () => ({
      nodes: [
        node("mm-root", -70, -32, { shape: "rounded", label: "中心主题", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", width: 140, height: 64 }),
        node("mm-a", 230, -170, { shape: "rounded", label: "分支 A", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", width: 120, height: 56 }),
        node("mm-a1", 440, -210, { shape: "rounded", label: "子主题 A1", fill: "#f8fafc", stroke: "#94a3b8", width: 120, height: 52 }),
        node("mm-a2", 440, -130, { shape: "rounded", label: "子主题 A2", fill: "#f8fafc", stroke: "#94a3b8", width: 120, height: 52 }),
        node("mm-b", 230, -60, { shape: "rounded", label: "分支 B", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 120, height: 56 }),
        node("mm-c", 230, 50, { shape: "rounded", label: "分支 C", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 120, height: 56 }),
        node("mm-d", -330, -110, { shape: "rounded", label: "分支 D", fill: "#fce7f3", stroke: "#db2777", textColor: "#9d174d", width: 120, height: 56 }),
        node("mm-e", -330, 20, { shape: "rounded", label: "分支 E", fill: "#ccfbf1", stroke: "#0d9488", textColor: "#115e59", width: 120, height: 56 }),
      ],
      edges: [
        edge("me-1", "mm-root", "mm-a", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-2", "mm-a", "mm-a1", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-3", "mm-a", "mm-a2", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-4", "mm-root", "mm-b", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-5", "mm-root", "mm-c", { sourceHandle: "r", targetHandle: "l" }),
        edge("me-6", "mm-root", "mm-d", { sourceHandle: "l", targetHandle: "r" }),
        edge("me-7", "mm-root", "mm-e", { sourceHandle: "l", targetHandle: "r" }),
      ],
    }),
  },
];
