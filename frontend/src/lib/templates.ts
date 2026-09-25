import type { Edge, Node } from "@xyflow/react";
import { defaultEdgeData, defaultNodeData, type EdgeData, type ShapeNodeData, type ShapeType } from "./types";
import { SEQ_HEIGHT, SEQ_WIDTH } from "./sequence";

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

/** A sequence-diagram participant (lifeline) node. */
function lifeline(id: string, x: number, y: number, label: string, stroke = "#475569"): Node {
  const data: ShapeNodeData = {
    ...defaultNodeData("rect"),
    label,
    fill: "#ffffff",
    stroke,
    textColor: "#0f172a",
    width: SEQ_WIDTH,
    height: SEQ_HEIGHT,
  };
  return {
    id,
    type: "lifeline",
    position: { x, y },
    data,
    style: { width: SEQ_WIDTH, height: SEQ_HEIGHT },
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
  {
    id: "sequence",
    name: "时序图",
    description: "参与者 / 生命线 / 消息",
    build: () => ({
      nodes: [
        lifeline("sq-user", 0, 0, "用户", "#0284c7"),
        lifeline("sq-web", 230, 0, "浏览器", "#7c3aed"),
        lifeline("sq-api", 460, 0, "服务器", "#16a34a"),
        lifeline("sq-db", 690, 0, "数据库", "#d97706"),
      ],
      edges: [
        edge("sq-m1", "sq-user", "sq-web", { sourceHandle: "r0", targetHandle: "l0", label: "打开页面", pathType: "straight" }),
        edge("sq-m2", "sq-web", "sq-api", { sourceHandle: "r1", targetHandle: "l1", label: "请求 /api", pathType: "straight" }),
        edge("sq-m3", "sq-api", "sq-db", { sourceHandle: "r2", targetHandle: "l2", label: "查询", pathType: "straight" }),
        edge("sq-m4", "sq-db", "sq-api", { sourceHandle: "l3", targetHandle: "r3", label: "结果", pathType: "straight", lineStyle: "dashed" }),
        edge("sq-m5", "sq-api", "sq-web", { sourceHandle: "l4", targetHandle: "r4", label: "响应", pathType: "straight", lineStyle: "dashed" }),
        edge("sq-m6", "sq-web", "sq-user", { sourceHandle: "l5", targetHandle: "r5", label: "渲染", pathType: "straight" }),
      ],
    }),
  },
  {
    id: "k8s",
    name: "Kubernetes",
    description: "Ingress / Service / Pod / 存储",
    build: () => ({
      nodes: [
        node("k-ing", -60, 0, { shape: "hexagon", label: "Ingress", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", width: 130, height: 70 }),
        node("k-svc", 160, 0, { shape: "rounded", label: "Service", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", width: 120, height: 60 }),
        node("k-pod1", 380, -80, { shape: "rounded", label: "Pod A", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 110, height: 56 }),
        node("k-pod2", 380, 30, { shape: "rounded", label: "Pod B", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 110, height: 56 }),
        node("k-cm", 380, 150, { shape: "document", label: "ConfigMap", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 110, height: 90 }),
        node("k-pvc", 620, -80, { shape: "cylinder", label: "PVC", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 100, height: 100 }),
        node("k-sa", 620, 110, { shape: "ellipse", label: "ServiceAccount", fill: "#fee2e2", stroke: "#dc2626", textColor: "#991b1b", width: 140, height: 80 }),
      ],
      edges: [
        edge("ke-1", "k-ing", "k-svc", { sourceHandle: "r", targetHandle: "l" }),
        edge("ke-2", "k-svc", "k-pod1", { sourceHandle: "r", targetHandle: "l" }),
        edge("ke-3", "k-svc", "k-pod2", { sourceHandle: "r", targetHandle: "l" }),
        edge("ke-4", "k-svc", "k-cm", { sourceHandle: "b", targetHandle: "t", lineStyle: "dashed" }),
        edge("ke-5", "k-pod1", "k-pvc", { sourceHandle: "r", targetHandle: "l" }),
        edge("ke-6", "k-pod2", "k-sa", { sourceHandle: "r", targetHandle: "l", lineStyle: "dashed" }),
      ],
    }),
  },
  {
    id: "er",
    name: "ER 图",
    description: "实体关系模型",
    build: () => ({
      nodes: [
        node("er-user", 0, 0, { shape: "rect", label: "User\nid / name / email", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", width: 170, height: 90 }),
        node("er-order", 320, -60, { shape: "rect", label: "Order\nid / userId / total", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 170, height: 90 }),
        node("er-item", 640, -60, { shape: "rect", label: "OrderItem\nid / orderId / qty", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 170, height: 90 }),
        node("er-prod", 640, 120, { shape: "rect", label: "Product\nid / name / price", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", width: 170, height: 90 }),
      ],
      edges: [
        edge("ere-1", "er-user", "er-order", { sourceHandle: "r", targetHandle: "l", label: "1 : n" }),
        edge("ere-2", "er-order", "er-item", { sourceHandle: "r", targetHandle: "l", label: "1 : n" }),
        edge("ere-3", "er-prod", "er-item", { sourceHandle: "t", targetHandle: "b", label: "1 : n" }),
      ],
    }),
  },
  {
    id: "org",
    name: "组织架构",
    description: "公司 / 部门 / 团队",
    build: () => ({
      nodes: [
        node("o-ceo", 260, 0, { shape: "rounded", label: "CEO", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6", width: 130, height: 60 }),
        node("o-cto", 40, 140, { shape: "rounded", label: "CTO", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985", width: 120, height: 56 }),
        node("o-cfo", 260, 140, { shape: "rounded", label: "CFO", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534", width: 120, height: 56 }),
        node("o-coo", 480, 140, { shape: "rounded", label: "COO", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e", width: 120, height: 56 }),
        node("o-fe", -80, 280, { shape: "rect", label: "前端团队", fill: "#f8fafc", stroke: "#94a3b8", width: 120, height: 50 }),
        node("o-be", 80, 280, { shape: "rect", label: "后端团队", fill: "#f8fafc", stroke: "#94a3b8", width: 120, height: 50 }),
        node("o-ops", 440, 280, { shape: "rect", label: "运维团队", fill: "#f8fafc", stroke: "#94a3b8", width: 120, height: 50 }),
      ],
      edges: [
        edge("oe-1", "o-ceo", "o-cto", { sourceHandle: "l", targetHandle: "t" }),
        edge("oe-2", "o-ceo", "o-cfo", { sourceHandle: "b", targetHandle: "t" }),
        edge("oe-3", "o-ceo", "o-coo", { sourceHandle: "r", targetHandle: "t" }),
        edge("oe-4", "o-cto", "o-fe", { sourceHandle: "b", targetHandle: "t" }),
        edge("oe-5", "o-cto", "o-be", { sourceHandle: "b", targetHandle: "t" }),
        edge("oe-6", "o-coo", "o-ops", { sourceHandle: "b", targetHandle: "t" }),
      ],
    }),
  },
];
