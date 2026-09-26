import { useMemo, useRef } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { ChevronLeft, LayoutGrid, MousePointerClick, Package, Settings2 } from "lucide-react";
import { Shape } from "./Shape";
import { Separator } from "@/components/ui/separator";
import { useEditor } from "@/lib/store";
import { defaultNodeData, SHAPE_LIST, type ShapeNodeData, type ShapeType } from "@/lib/types";
import { uid } from "@/lib/id";
import { useT } from "@/lib/i18n";
import { ICON_MAP, ICON_PRESETS, TONES } from "./icons";
import { componentBounds, useComponents, type ComponentDef } from "@/lib/components";
import { useUi } from "@/lib/ui";

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

/** Map an architecture preset to a visual shape. */
const PRESET_SHAPES: Record<string, ShapeType> = {
  db: "cylinder",
  storage: "cylinder",
  mq: "parallelogram",
  cdn: "cloud",
  worker: "hexagon",
  client: "rounded",
  gateway: "hexagon",
  service: "rounded",
  cache: "ellipse",
  lb: "diamond",
};

function ShapeThumb({ shape }: { shape: ShapeType }) {
  return (
    <svg width={40} height={30} viewBox="0 0 40 30" className="pointer-events-none overflow-visible">
      <g transform="translate(2,2)">
        <Shape shape={shape} width={36} height={26} fill="#f8fafc" stroke="#475569" strokeWidth={1.5} radius={5} />
      </g>
    </svg>
  );
}

export function buildIconNode(
  iconKey: string,
  label: string,
  position: { x: number; y: number }
): Node | null {
  const preset = ICON_PRESETS.find((p) => p.icon === iconKey);
  if (!preset || !ICON_MAP[iconKey]) return null;
  const tone = TONES[preset.tone] ?? TONES.slate;
  const data: ShapeNodeData = {
    ...defaultNodeData("rounded"),
    label,
    fill: tone.fill,
    stroke: tone.stroke,
    textColor: tone.textColor,
    icon: iconKey,
    width: 110,
    height: 84,
  };
  return {
    id: uid("n_"),
    type: "shape",
    position: { x: position.x - data.width / 2, y: position.y - data.height / 2 },
    data,
    style: { width: data.width, height: data.height },
    selected: true,
  };
}

/** Returns flow coordinates for the centre of the visible canvas. */
function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => {
    const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    return screenToFlowPosition({ x, y });
  };
}

export function ShapePalette({
  onAdded,
  onCollapse,
}: { onAdded?: () => void; onCollapse?: () => void } = {}) {
  const t = useT();
  const center = useViewportCenter();
  const addShapeNode = useEditor((s) => s.addShapeNode);
  const addNode = useEditor((s) => s.addNode);
  const insertFragment = useEditor((s) => s.insertFragment);
  const components = useComponents((s) => s.components);
  const grouped = useMemo(() => {
    const map = new Map<string, ComponentDef[]>();
    for (const c of components) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [components]);
  const cascade = useRef(0);

  const insertAtCenter = (c: ComponentDef) => {
    const pos = center();
    const b = componentBounds(c);
    insertFragment(c.nodes, c.edges, {
      x: pos.x - (b.minX + b.w / 2),
      y: pos.y - (b.minY + b.h / 2),
    });
    onAdded?.();
  };

  // Offset successive click-adds so they don't stack on top of each other.
  const nextOffset = () => {
    const n = cascade.current++ % 6;
    return n * 24;
  };

  const onDragStart = (e: React.DragEvent, kind: "shape" | "preset" | "icon", value: string) => {
    e.dataTransfer.setData("application/diagram-kind", kind);
    e.dataTransfer.setData("application/diagram-value", value);
    e.dataTransfer.effectAllowed = "copy";
  };

  const addIcon = (iconKey: string) => {
    const preset = ICON_PRESETS.find((p) => p.icon === iconKey);
    if (!preset) return;
    const pos = center();
    const off = nextOffset();
    const node = buildIconNode(iconKey, t(preset.labelKey), { x: pos.x + off, y: pos.y + off });
    if (node) addNode(node);
    onAdded?.();
  };

  // Click-to-add places the item at the centre of the current viewport.
  const addShape = (shape: ShapeType) => {
    const data = defaultNodeData(shape);
    const pos = center();
    const off = nextOffset();
    addShapeNode(shape, { x: pos.x - data.width / 2 + off, y: pos.y - data.height / 2 + off });
    onAdded?.();
  };

  const addPreset = (key: string) => {
    const preset = ARCH_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const shape = PRESET_SHAPES[key] ?? "rounded";
    const data = {
      ...defaultNodeData(shape),
      label: t(`arch.${preset.key}`),
      fill: preset.fill,
      stroke: preset.stroke,
      textColor: preset.textColor,
    };
    const pos = center();
    const off = nextOffset();
    addNode({
      id: uid("n_"),
      type: "shape",
      position: { x: pos.x - data.width / 2 + off, y: pos.y - data.height / 2 + off },
      data,
      style: { width: data.width, height: data.height },
      selected: true,
    });
    onAdded?.();
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {onCollapse ? (
        <div className="flex h-8 shrink-0 items-center gap-1.5 border-b px-3">
          <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">{t("palette.panelTitle")}</span>
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t("panel.collapse")}
            title={t("panel.collapse")}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
        <span>{t("palette.hint")}</span>
      </div>

      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("palette.basic")}
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPE_LIST.map((shape) => (
            <button
              key={shape}
              type="button"
              draggable
              onDragStart={(e) => onDragStart(e, "shape", shape)}
              onClick={() => addShape(shape)}
              title={`${t(`shape.${shape}`)} · ${t("palette.hint")}`}
              className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-transparent p-1.5 transition-colors hover:border-border hover:bg-accent active:cursor-grabbing"
            >
              <ShapeThumb shape={shape} />
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {t(`shape.${shape}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("palette.arch")}
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {ARCH_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              draggable
              onDragStart={(e) => onDragStart(e, "preset", p.key)}
              onClick={() => addPreset(p.key)}
              title={`${t(`arch.${p.key}`)} · ${t("palette.hint")}`}
              className="flex cursor-grab items-center gap-2 rounded-md border p-1.5 text-left transition-colors hover:bg-accent active:cursor-grabbing"
            >
              <span
                className="pointer-events-none h-4 w-4 shrink-0 rounded"
                style={{ background: p.fill, border: `2px solid ${p.stroke}` }}
              />
              <span className="truncate text-[11px]">{t(`arch.${p.key}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("palette.icons")}
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {ICON_PRESETS.map((p) => {
            const Icon = ICON_MAP[p.icon];
            const tone = TONES[p.tone] ?? TONES.slate;
            return (
              <button
                key={p.icon}
                type="button"
                draggable
                onDragStart={(e) => onDragStart(e, "icon", p.icon)}
                onClick={() => addIcon(p.icon)}
                title={`${t(p.labelKey)} · ${t("palette.hint")}`}
                className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-transparent p-1.5 transition-colors hover:border-border hover:bg-accent active:cursor-grabbing"
              >
                <span
                  className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: tone.fill, color: tone.stroke }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {t(p.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("comp.my")}
          </h3>
          <button
            type="button"
            onClick={() => useUi.getState().setComponentLibraryOpen(true)}
            title={t("comp.manage")}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {components.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("comp.emptyHint")}</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <div className="mb-1 text-[10px] font-medium text-muted-foreground">{cat}</div>
                <div className="space-y-1">
                  {list.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/diagram-kind", "component");
                        e.dataTransfer.setData("application/diagram-value", c.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => insertAtCenter(c)}
                      title={`${c.name} · ${t("comp.addHint")}`}
                      className="flex w-full cursor-grab items-center gap-2 rounded-md border p-1.5 text-left transition-colors hover:bg-accent active:cursor-grabbing"
                    >
                      <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-[11px]">{c.name}</span>
                      <span className="ml-auto shrink-0 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                        {c.kind === "compound" ? t("comp.compound") : t("comp.single")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ARCH_PRESETS, PRESET_SHAPES };
