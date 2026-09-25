import { useMemo, type ReactNode } from "react";
import { Bold, Italic, RotateCw, Trash2, X, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorField } from "./ColorField";
import { useEditor, type AlignMode } from "@/lib/store";
import { SHAPE_LABELS, SHAPE_LIST, type EdgeData, type ShapeNodeData } from "@/lib/types";
import { cn } from "@/lib/utils";

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="h-8 text-xs"
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <Row label={label} hint={`${Math.round(value * 100) / 100}${suffix ?? ""}`}>
      <div className="flex items-center gap-3">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <div className="w-16">
          <NumberField value={value} onChange={onChange} min={min} max={max} step={step} />
        </div>
      </div>
    </Row>
  );
}

function ArrowSelect({
  value,
  onChange,
  label,
}: {
  value: EdgeData["arrowType"];
  onChange: (v: EdgeData["arrowType"]) => void;
  label: string;
}) {
  return (
    <Row label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as EdgeData["arrowType"])}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="arrowclosed" className="text-xs">
            实心箭头
          </SelectItem>
          <SelectItem value="arrow" className="text-xs">
            空心箭头
          </SelectItem>
          <SelectItem value="diamond" className="text-xs">
            菱形
          </SelectItem>
          <SelectItem value="none" className="text-xs">
            无
          </SelectItem>
        </SelectContent>
      </Select>
    </Row>
  );
}

export function Inspector() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const selected = useEditor((s) => s.selected);
  const selectedIds = useEditor((s) => s.selectedIds);

  const node = useMemo(() => nodes.find((n) => n.id === selected), [nodes, selected]);
  const edge = useMemo(() => edges.find((e) => e.id === selected), [edges, selected]);

  if (selectedIds.length > 1) return <MultiInspector />;
  if (node) return <NodeInspector id={node.id} data={node.data as ShapeNodeData} />;
  if (edge) return <EdgeInspector id={edge.id} data={edge.data as EdgeData} />;
  return <CanvasInspector />;
}

function NodeInspector({ id, data }: { id: string; data: ShapeNodeData }) {
  const update = useEditor((s) => s.updateNodeData);
  const remove = useEditor((s) => s.removeSelected);
  const setSelected = useEditor((s) => s.setSelected);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">节点属性</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)} title="取消选择">
            <X className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} title="删除">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Row label="文本">
          <Input
            value={data.label}
            onChange={(e) => update(id, { label: e.target.value })}
            className="h-8 text-xs"
            placeholder="输入文字…"
          />
        </Row>

        <Row label="形状">
          <Select value={data.shape} onValueChange={(v) => update(id, { shape: v as ShapeNodeData["shape"] })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHAPE_LIST.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {SHAPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="填充颜色">
          <ColorField value={data.fill} onChange={(v) => update(id, { fill: v })} />
        </Row>

        <Row label="边框颜色">
          <ColorField value={data.stroke} onChange={(v) => update(id, { stroke: v })} />
        </Row>

        <SliderRow label="边框粗细" value={data.strokeWidth} min={0} max={12} step={0.5} onChange={(v) => update(id, { strokeWidth: v })} />
        <SliderRow label="圆角大小" value={data.radius} min={0} max={50} onChange={(v) => update(id, { radius: v })} />

        <Separator />

        <Row label="文字颜色">
          <ColorField value={data.textColor} onChange={(v) => update(id, { textColor: v })} />
        </Row>

        <SliderRow label="字号" value={data.fontSize} min={8} max={48} onChange={(v) => update(id, { fontSize: v })} />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={data.fontWeight === "bold" ? "default" : "outline"}
            size="sm"
            className="h-8 flex-1"
            onClick={() => update(id, { fontWeight: data.fontWeight === "bold" ? "normal" : "bold" })}
          >
            <Bold className="h-3.5 w-3.5" /> 加粗
          </Button>
          <Button
            type="button"
            variant={data.fontStyle === "italic" ? "default" : "outline"}
            size="sm"
            className="h-8 flex-1"
            onClick={() => update(id, { fontStyle: data.fontStyle === "italic" ? "normal" : "italic" })}
          >
            <Italic className="h-3.5 w-3.5" /> 斜体
          </Button>
        </div>

        <Separator />

        <SliderRow label="旋转角度" value={data.rotation} min={-180} max={180} suffix="°" onChange={(v) => update(id, { rotation: v })} />
        <div className="flex gap-1">
          {[0, 45, 90, 135, 180, 270].map((deg) => (
            <Button
              key={deg}
              variant="outline"
              size="sm"
              className="h-7 flex-1 px-0 text-[10px]"
              onClick={() => update(id, { rotation: deg > 180 ? deg - 360 : deg })}
            >
              {deg}°
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-8 w-full" onClick={() => update(id, { rotation: 0 })}>
          <RotateCw className="h-3.5 w-3.5" /> 重置角度
        </Button>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <Row label="宽度">
            <NumberField value={data.width} min={20} onChange={(v) => update(id, { width: v })} suffix="px" />
          </Row>
          <Row label="高度">
            <NumberField value={data.height} min={20} onChange={(v) => update(id, { height: v })} suffix="px" />
          </Row>
        </div>

        <SliderRow label="不透明度" value={data.opacity} min={0.1} max={1} step={0.05} onChange={(v) => update(id, { opacity: v })} />
      </div>
    </div>
  );
}

function EdgeInspector({ id, data }: { id: string; data: EdgeData }) {
  const update = useEditor((s) => s.updateEdgeData);
  const remove = useEditor((s) => s.removeSelected);
  const setSelected = useEditor((s) => s.setSelected);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">连线属性</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)} title="取消选择">
            <X className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} title="删除">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Row label="标签文字">
          <Input
            value={data.label}
            onChange={(e) => update(id, { label: e.target.value })}
            className="h-8 text-xs"
            placeholder="连线标签…"
          />
        </Row>

        <Row label="线条颜色">
          <ColorField value={data.color} onChange={(v) => update(id, { color: v })} allowTransparent={false} />
        </Row>

        <SliderRow label="线条粗细" value={data.width} min={1} max={12} step={0.5} onChange={(v) => update(id, { width: v })} />

        <Row label="线条样式">
          <Tabs value={data.lineStyle} onValueChange={(v) => update(id, { lineStyle: v as EdgeData["lineStyle"] })}>
            <TabsList className="grid h-8 w-full grid-cols-3">
              <TabsTrigger value="solid" className="text-xs">
                实线
              </TabsTrigger>
              <TabsTrigger value="dashed" className="text-xs">
                虚线
              </TabsTrigger>
              <TabsTrigger value="dotted" className="text-xs">
                点线
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Row>

        <Row label="路径类型">
          <Select value={data.pathType} onValueChange={(v) => update(id, { pathType: v as EdgeData["pathType"] })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bezier" className="text-xs">
                贝塞尔曲线
              </SelectItem>
              <SelectItem value="straight" className="text-xs">
                直线
              </SelectItem>
              <SelectItem value="step" className="text-xs">
                折线（直角）
              </SelectItem>
              <SelectItem value="smoothstep" className="text-xs">
                折线（圆角）
              </SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <ArrowSelect label="终点箭头" value={data.arrowType} onChange={(v) => update(id, { arrowType: v })} />
        <ArrowSelect label="起点箭头" value={data.startArrowType ?? "none"} onChange={(v) => update(id, { startArrowType: v })} />

        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">流动动画</Label>
          <Switch checked={data.animated} onCheckedChange={(v) => update(id, { animated: v })} />
        </div>

        <Separator />

        <SliderRow label="标签角度" value={data.labelRotation} min={-180} max={180} suffix="°" onChange={(v) => update(id, { labelRotation: v })} />

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">控制点（拖动改变路径，双击删除）</Label>
            <span className="text-[10px] text-muted-foreground">{data.points?.length ?? 0} 个</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            选中连线后，点击线段中间的圆点即可新增控制点；拖动圆点调整线条走向，双击圆点删除。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full"
            disabled={!data.points || data.points.length === 0}
            onClick={() => update(id, { points: [] })}
          >
            清除全部控制点
          </Button>
        </div>
      </div>
    </div>
  );
}

function AlignTools({ count }: { count: number }) {
  const align = useEditor((s) => s.alignNodes);
  const distribute = useEditor((s) => s.distributeNodes);

  const alignButtons: { mode: AlignMode; label: string }[] = [
    { mode: "left", label: "左对齐" },
    { mode: "hcenter", label: "水平居中" },
    { mode: "right", label: "右对齐" },
    { mode: "top", label: "顶部对齐" },
    { mode: "vcenter", label: "垂直居中" },
    { mode: "bottom", label: "底部对齐" },
  ];

  return (
    <div className="space-y-3">
      <Row label="对齐">
        <div className="grid grid-cols-3 gap-1">
          {alignButtons.map((b) => (
            <Button
              key={b.mode}
              variant="outline"
              size="sm"
              className="h-8 px-1 text-[11px]"
              disabled={count < 2}
              onClick={() => align(b.mode)}
            >
              {b.label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="分布">
        <div className="grid grid-cols-2 gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px]"
            disabled={count < 3}
            onClick={() => distribute("horizontal")}
          >
            水平等距
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px]"
            disabled={count < 3}
            onClick={() => distribute("vertical")}
          >
            垂直等距
          </Button>
        </div>
      </Row>
    </div>
  );
}

function MultiInspector() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const selectedIds = useEditor((s) => s.selectedIds);
  const updateManyNodes = useEditor((s) => s.updateManyNodes);
  const updateManyEdges = useEditor((s) => s.updateManyEdges);
  const remove = useEditor((s) => s.removeSelected);
  const duplicate = useEditor((s) => s.duplicateSelected);
  const setSelection = useEditor((s) => s.setSelection);

  const nodeIds = useMemo(() => nodes.filter((n) => selectedIds.includes(n.id)).map((n) => n.id), [nodes, selectedIds]);
  const edgeIds = useMemo(() => edges.filter((e) => selectedIds.includes(e.id)).map((e) => e.id), [edges, selectedIds]);
  const hasNodes = nodeIds.length > 0;
  const hasEdges = edgeIds.length > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">
          已选 {nodeIds.length > 0 ? `${nodeIds.length} 个节点` : ""}
          {nodeIds.length > 0 && edgeIds.length > 0 ? " · " : ""}
          {edgeIds.length > 0 ? `${edgeIds.length} 条连线` : ""}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelection([])} title="取消选择">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {hasNodes && (
          <>
            <Row label="填充颜色">
              <ColorField value="#ffffff" onChange={(v) => updateManyNodes(nodeIds, { fill: v })} />
            </Row>
            <Row label="边框颜色">
              <ColorField value="#475569" onChange={(v) => updateManyNodes(nodeIds, { stroke: v })} />
            </Row>
            <Row label="文字颜色">
              <ColorField value="#0f172a" onChange={(v) => updateManyNodes(nodeIds, { textColor: v })} />
            </Row>
            <SliderRow label="边框粗细" value={2} min={0} max={12} step={0.5} onChange={(v) => updateManyNodes(nodeIds, { strokeWidth: v })} />
            <SliderRow label="字号" value={14} min={8} max={48} onChange={(v) => updateManyNodes(nodeIds, { fontSize: v })} />
            <SliderRow label="圆角大小" value={8} min={0} max={50} onChange={(v) => updateManyNodes(nodeIds, { radius: v })} />
            <SliderRow label="不透明度" value={1} min={0.1} max={1} step={0.05} onChange={(v) => updateManyNodes(nodeIds, { opacity: v })} />
            <SliderRow label="旋转角度" value={0} min={-180} max={180} suffix="°" onChange={(v) => updateManyNodes(nodeIds, { rotation: v })} />
            <Separator />
            <AlignTools count={nodeIds.length} />
          </>
        )}

        {hasNodes && hasEdges && <Separator />}

        {hasEdges && (
          <>
            <Row label="线条颜色">
              <ColorField value="#475569" onChange={(v) => updateManyEdges(edgeIds, { color: v })} allowTransparent={false} />
            </Row>
            <SliderRow label="线条粗细" value={2} min={1} max={12} step={0.5} onChange={(v) => updateManyEdges(edgeIds, { width: v })} />
            <Row label="线条样式">
              <Tabs value="solid" onValueChange={(v) => updateManyEdges(edgeIds, { lineStyle: v as EdgeData["lineStyle"] })}>
                <TabsList className="grid h-8 w-full grid-cols-3">
                  <TabsTrigger value="solid" className="text-xs">
                    实线
                  </TabsTrigger>
                  <TabsTrigger value="dashed" className="text-xs">
                    虚线
                  </TabsTrigger>
                  <TabsTrigger value="dotted" className="text-xs">
                    点线
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Row>
            <ArrowSelect label="终点箭头" value="arrowclosed" onChange={(v) => updateManyEdges(edgeIds, { arrowType: v })} />
          </>
        )}

        <Separator />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={duplicate}>
            <Copy className="h-3.5 w-3.5" /> 复制
          </Button>
          <Button variant="destructive" size="sm" className="h-8" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          提示：拖动节点外的空白区域可框选多个节点；按 Shift 可点选多个。
        </p>
      </div>
    </div>
  );
}

function CanvasInspector() {
  const meta = useEditor((s) => s.meta);
  const setMeta = useEditor((s) => s.setMeta);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-3 py-2">
        <span className="text-sm font-semibold">画布 / 文档</span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Row label="图纸名称">
          <Input value={meta.name} onChange={(e) => setMeta({ name: e.target.value, saved: false })} className="h-8 text-xs" />
        </Row>
        <Row label="描述">
          <Input
            value={meta.description}
            onChange={(e) => setMeta({ description: e.target.value, saved: false })}
            className="h-8 text-xs"
            placeholder="可选"
          />
        </Row>
        <Separator />
        <div className={cn("grid grid-cols-2 gap-2 text-center")}>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{nodes.length}</div>
            <div className="text-[11px] text-muted-foreground">节点</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{edges.length}</div>
            <div className="text-[11px] text-muted-foreground">连线</div>
          </div>
        </div>
        <Separator />
        <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">快捷键</p>
          <p>拖拽左侧图形到画布添加节点</p>
          <p>拖拽节点边缘圆点连线</p>
          <p>Shift / 框选可多选，批量编辑</p>
          <p>Delete 删除选中 · Ctrl+D 复制</p>
          <p>Ctrl+Z 撤销 · Ctrl+Shift+Z 重做</p>
          <p>拖动连线中点圆点改变路径</p>
        </div>
      </div>
    </div>
  );
}
