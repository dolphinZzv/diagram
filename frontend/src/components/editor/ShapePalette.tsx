import { Shape } from "./Shape";
import { Separator } from "@/components/ui/separator";
import { SHAPE_LIST, SHAPE_LABELS, type ShapeType } from "@/lib/types";

interface Preset {
  key: string;
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
}

const ARCH_PRESETS: Preset[] = [
  { key: "client", label: "客户端", fill: "#e0f2fe", stroke: "#0284c7", textColor: "#075985" },
  { key: "gateway", label: "API 网关", fill: "#ede9fe", stroke: "#7c3aed", textColor: "#5b21b6" },
  { key: "service", label: "服务", fill: "#dcfce7", stroke: "#16a34a", textColor: "#166534" },
  { key: "db", label: "数据库", fill: "#fef3c7", stroke: "#d97706", textColor: "#92400e" },
  { key: "cache", label: "缓存", fill: "#fee2e2", stroke: "#dc2626", textColor: "#991b1b" },
  { key: "mq", label: "消息队列", fill: "#fce7f3", stroke: "#db2777", textColor: "#9d174d" },
  { key: "storage", label: "对象存储", fill: "#e0e7ff", stroke: "#4f46e5", textColor: "#3730a3" },
  { key: "lb", label: "负载均衡", fill: "#ccfbf1", stroke: "#0d9488", textColor: "#115e59" },
  { key: "cdn", label: "CDN", fill: "#f3e8ff", stroke: "#9333ea", textColor: "#6b21a8" },
  { key: "worker", label: "任务 Worker", fill: "#ffedd5", stroke: "#ea580c", textColor: "#9a3412" },
];

function ShapeThumb({ shape }: { shape: ShapeType }) {
  return (
    <svg width={40} height={30} viewBox="0 0 40 30" className="overflow-visible">
      <g transform="translate(2,2)">
        <Shape
          shape={shape}
          width={36}
          height={26}
          fill="#f8fafc"
          stroke="#475569"
          strokeWidth={1.5}
          radius={5}
        />
      </g>
    </svg>
  );
}

export function ShapePalette() {
  const onDragStart = (e: React.DragEvent, kind: "shape" | "preset", value: string) => {
    e.dataTransfer.setData("application/diagram-kind", kind);
    e.dataTransfer.setData("application/diagram-value", value);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">基础形状</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPE_LIST.map((shape) => (
            <button
              key={shape}
              draggable
              onDragStart={(e) => onDragStart(e, "shape", shape)}
              title={SHAPE_LABELS[shape]}
              className="flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 transition-colors hover:border-border hover:bg-accent"
            >
              <ShapeThumb shape={shape} />
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {SHAPE_LABELS[shape]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">架构组件</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {ARCH_PRESETS.map((p) => (
            <button
              key={p.key}
              draggable
              onDragStart={(e) => onDragStart(e, "preset", p.key)}
              className="flex items-center gap-2 rounded-md border p-1.5 text-left transition-colors hover:bg-accent"
            >
              <span
                className="h-4 w-4 shrink-0 rounded"
                style={{ background: p.fill, border: `2px solid ${p.stroke}` }}
              />
              <span className="truncate text-[11px]">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { ARCH_PRESETS };
