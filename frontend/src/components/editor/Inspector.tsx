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
import { SHAPE_LIST, type EdgeData, type ShapeNodeData } from "@/lib/types";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  return (
    <Row label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as EdgeData["arrowType"])}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="arrowclosed" className="text-xs">
            {t("inspector.arrowClosed")}
          </SelectItem>
          <SelectItem value="arrow" className="text-xs">
            {t("inspector.arrowOpen")}
          </SelectItem>
          <SelectItem value="diamond" className="text-xs">
            {t("inspector.diamond")}
          </SelectItem>
          <SelectItem value="none" className="text-xs">
            {t("inspector.none")}
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
  const t = useT();
  const update = useEditor((s) => s.updateNodeData);
  const remove = useEditor((s) => s.removeSelected);
  const setSelected = useEditor((s) => s.setSelected);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">{t("inspector.nodeTitle")}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)} title={t("inspector.cancel")}>
            <X className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} title={t("inspector.remove")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Row label={t("inspector.text")}>
          <Input
            value={data.label}
            onChange={(e) => update(id, { label: e.target.value })}
            className="h-8 text-xs"
            placeholder={t("inspector.textPlaceholder")}
          />
        </Row>

        <Row label={t("inspector.shape")}>
          <Select value={data.shape} onValueChange={(v) => update(id, { shape: v as ShapeNodeData["shape"] })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHAPE_LIST.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {t(`shape.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label={t("inspector.fill")}>
          <ColorField value={data.fill} onChange={(v) => update(id, { fill: v })} />
        </Row>

        <Row label={t("inspector.stroke")}>
          <ColorField value={data.stroke} onChange={(v) => update(id, { stroke: v })} />
        </Row>

        <SliderRow label={t("inspector.strokeWidth")} value={data.strokeWidth} min={0} max={12} step={0.5} onChange={(v) => update(id, { strokeWidth: v })} />
        <SliderRow label={t("inspector.radius")} value={data.radius} min={0} max={50} onChange={(v) => update(id, { radius: v })} />

        <Separator />

        <Row label={t("inspector.textColor")}>
          <ColorField value={data.textColor} onChange={(v) => update(id, { textColor: v })} />
        </Row>

        <SliderRow label={t("inspector.fontSize")} value={data.fontSize} min={8} max={48} onChange={(v) => update(id, { fontSize: v })} />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={data.fontWeight === "bold" ? "default" : "outline"}
            size="sm"
            className="h-8 flex-1"
            onClick={() => update(id, { fontWeight: data.fontWeight === "bold" ? "normal" : "bold" })}
          >
            <Bold className="h-3.5 w-3.5" /> {t("inspector.bold")}
          </Button>
          <Button
            type="button"
            variant={data.fontStyle === "italic" ? "default" : "outline"}
            size="sm"
            className="h-8 flex-1"
            onClick={() => update(id, { fontStyle: data.fontStyle === "italic" ? "normal" : "italic" })}
          >
            <Italic className="h-3.5 w-3.5" /> {t("inspector.italic")}
          </Button>
        </div>

        <Separator />

        <SliderRow label={t("inspector.rotation")} value={data.rotation} min={-180} max={180} suffix="°" onChange={(v) => update(id, { rotation: v })} />
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
          <RotateCw className="h-3.5 w-3.5" /> {t("inspector.resetAngle")}
        </Button>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <Row label={t("inspector.width")}>
            <NumberField value={data.width} min={20} onChange={(v) => update(id, { width: v })} suffix="px" />
          </Row>
          <Row label={t("inspector.height")}>
            <NumberField value={data.height} min={20} onChange={(v) => update(id, { height: v })} suffix="px" />
          </Row>
        </div>

        <SliderRow label={t("inspector.opacity")} value={data.opacity} min={0.1} max={1} step={0.05} onChange={(v) => update(id, { opacity: v })} />
      </div>
    </div>
  );
}

function EdgeInspector({ id, data }: { id: string; data: EdgeData }) {
  const t = useT();
  const update = useEditor((s) => s.updateEdgeData);
  const remove = useEditor((s) => s.removeSelected);
  const setSelected = useEditor((s) => s.setSelected);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">{t("inspector.edgeTitle")}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)} title={t("inspector.cancel")}>
            <X className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} title={t("inspector.remove")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Row label={t("inspector.label")}>
          <Input
            value={data.label}
            onChange={(e) => update(id, { label: e.target.value })}
            className="h-8 text-xs"
            placeholder={t("inspector.labelPlaceholder")}
          />
        </Row>

        <Row label={t("inspector.lineColor")}>
          <ColorField value={data.color} onChange={(v) => update(id, { color: v })} allowTransparent={false} />
        </Row>

        <SliderRow label={t("inspector.lineWidth")} value={data.width} min={1} max={12} step={0.5} onChange={(v) => update(id, { width: v })} />

        <Row label={t("inspector.lineStyle")}>
          <Tabs value={data.lineStyle} onValueChange={(v) => update(id, { lineStyle: v as EdgeData["lineStyle"] })}>
            <TabsList className="grid h-8 w-full grid-cols-3">
              <TabsTrigger value="solid" className="text-xs">
                {t("inspector.solid")}
              </TabsTrigger>
              <TabsTrigger value="dashed" className="text-xs">
                {t("inspector.dashed")}
              </TabsTrigger>
              <TabsTrigger value="dotted" className="text-xs">
                {t("inspector.dotted")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Row>

        <Row label={t("inspector.pathType")}>
          <Select value={data.pathType} onValueChange={(v) => update(id, { pathType: v as EdgeData["pathType"] })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bezier" className="text-xs">
                {t("inspector.bezier")}
              </SelectItem>
              <SelectItem value="straight" className="text-xs">
                {t("inspector.straight")}
              </SelectItem>
              <SelectItem value="step" className="text-xs">
                {t("inspector.step")}
              </SelectItem>
              <SelectItem value="smoothstep" className="text-xs">
                {t("inspector.smoothstep")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <ArrowSelect label={t("inspector.endArrow")} value={data.arrowType} onChange={(v) => update(id, { arrowType: v })} />
        <ArrowSelect label={t("inspector.startArrow")} value={data.startArrowType ?? "none"} onChange={(v) => update(id, { startArrowType: v })} />

        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{t("inspector.animated")}</Label>
          <Switch checked={data.animated} onCheckedChange={(v) => update(id, { animated: v })} />
        </div>

        <Separator />

        <SliderRow label={t("inspector.labelAngle")} value={data.labelRotation} min={-180} max={180} suffix="°" onChange={(v) => update(id, { labelRotation: v })} />

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t("inspector.points")}</Label>
            <span className="text-[10px] text-muted-foreground">{data.points?.length ?? 0}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("inspector.pointsHint")}</p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full"
            disabled={!data.points || data.points.length === 0}
            onClick={() => update(id, { points: [] })}
          >
            {t("inspector.clearPoints")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AlignTools({ count }: { count: number }) {
  const t = useT();
  const align = useEditor((s) => s.alignNodes);
  const distribute = useEditor((s) => s.distributeNodes);

  const alignButtons: { mode: AlignMode; label: string }[] = [
    { mode: "left", label: t("inspector.alignLeft") },
    { mode: "hcenter", label: t("inspector.alignCenterH") },
    { mode: "right", label: t("inspector.alignRight") },
    { mode: "top", label: t("inspector.alignTop") },
    { mode: "vcenter", label: t("inspector.alignCenterV") },
    { mode: "bottom", label: t("inspector.alignBottom") },
  ];

  return (
    <div className="space-y-3">
      <Row label={t("inspector.align")}>
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
      <Row label={t("inspector.distribute")}>
        <div className="grid grid-cols-2 gap-1">
          <Button variant="outline" size="sm" className="h-8 text-[11px]" disabled={count < 3} onClick={() => distribute("horizontal")}>
            {t("inspector.distH")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[11px]" disabled={count < 3} onClick={() => distribute("vertical")}>
            {t("inspector.distV")}
          </Button>
        </div>
      </Row>
    </div>
  );
}

function MultiInspector() {
  const t = useT();
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
        <span className="truncate text-sm font-semibold">
          {t("inspector.selected")} {nodeIds.length > 0 ? t("inspector.nodesN", { n: nodeIds.length }) : ""}
          {nodeIds.length > 0 && edgeIds.length > 0 ? " · " : ""}
          {edgeIds.length > 0 ? t("inspector.edgesN", { n: edgeIds.length }) : ""}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelection([])} title={t("inspector.cancel")}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {hasNodes && (
          <>
            <Row label={t("inspector.fill")}>
              <ColorField value="#ffffff" onChange={(v) => updateManyNodes(nodeIds, { fill: v })} />
            </Row>
            <Row label={t("inspector.stroke")}>
              <ColorField value="#475569" onChange={(v) => updateManyNodes(nodeIds, { stroke: v })} />
            </Row>
            <Row label={t("inspector.textColor")}>
              <ColorField value="#0f172a" onChange={(v) => updateManyNodes(nodeIds, { textColor: v })} />
            </Row>
            <SliderRow label={t("inspector.strokeWidth")} value={2} min={0} max={12} step={0.5} onChange={(v) => updateManyNodes(nodeIds, { strokeWidth: v })} />
            <SliderRow label={t("inspector.fontSize")} value={14} min={8} max={48} onChange={(v) => updateManyNodes(nodeIds, { fontSize: v })} />
            <SliderRow label={t("inspector.radius")} value={8} min={0} max={50} onChange={(v) => updateManyNodes(nodeIds, { radius: v })} />
            <SliderRow label={t("inspector.opacity")} value={1} min={0.1} max={1} step={0.05} onChange={(v) => updateManyNodes(nodeIds, { opacity: v })} />
            <SliderRow label={t("inspector.rotation")} value={0} min={-180} max={180} suffix="°" onChange={(v) => updateManyNodes(nodeIds, { rotation: v })} />
            <Separator />
            <AlignTools count={nodeIds.length} />
          </>
        )}

        {hasNodes && hasEdges && <Separator />}

        {hasEdges && (
          <>
            <Row label={t("inspector.lineColor")}>
              <ColorField value="#475569" onChange={(v) => updateManyEdges(edgeIds, { color: v })} allowTransparent={false} />
            </Row>
            <SliderRow label={t("inspector.lineWidth")} value={2} min={1} max={12} step={0.5} onChange={(v) => updateManyEdges(edgeIds, { width: v })} />
            <Row label={t("inspector.lineStyle")}>
              <Tabs value="solid" onValueChange={(v) => updateManyEdges(edgeIds, { lineStyle: v as EdgeData["lineStyle"] })}>
                <TabsList className="grid h-8 w-full grid-cols-3">
                  <TabsTrigger value="solid" className="text-xs">
                    {t("inspector.solid")}
                  </TabsTrigger>
                  <TabsTrigger value="dashed" className="text-xs">
                    {t("inspector.dashed")}
                  </TabsTrigger>
                  <TabsTrigger value="dotted" className="text-xs">
                    {t("inspector.dotted")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Row>
            <ArrowSelect label={t("inspector.endArrow")} value="arrowclosed" onChange={(v) => updateManyEdges(edgeIds, { arrowType: v })} />
          </>
        )}

        <Separator />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={duplicate}>
            <Copy className="h-3.5 w-3.5" /> {t("inspector.duplicate")}
          </Button>
          <Button variant="destructive" size="sm" className="h-8" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" /> {t("inspector.remove")}
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("inspector.multiHint")}</p>
      </div>
    </div>
  );
}

function CanvasInspector() {
  const t = useT();
  const meta = useEditor((s) => s.meta);
  const setMeta = useEditor((s) => s.setMeta);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-3 py-2">
        <span className="text-sm font-semibold">{t("inspector.canvasTitle")}</span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Row label={t("inspector.docName")}>
          <Input value={meta.name} onChange={(e) => setMeta({ name: e.target.value, saved: false })} className="h-8 text-xs" />
        </Row>
        <Row label={t("inspector.docDesc")}>
          <Input
            value={meta.description}
            onChange={(e) => setMeta({ description: e.target.value, saved: false })}
            className="h-8 text-xs"
            placeholder={t("inspector.optional")}
          />
        </Row>
        <Separator />
        <div className={cn("grid grid-cols-2 gap-2 text-center")}>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{nodes.length}</div>
            <div className="text-[11px] text-muted-foreground">{t("inspector.nodesCount")}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{edges.length}</div>
            <div className="text-[11px] text-muted-foreground">{t("inspector.edgesCount")}</div>
          </div>
        </div>
        <Separator />
        <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">{t("inspector.shortcuts")}</p>
          <p>{t("inspector.sc1")}</p>
          <p>{t("inspector.sc2")}</p>
          <p>{t("inspector.sc3")}</p>
          <p>{t("inspector.sc4")}</p>
          <p>{t("inspector.sc5")}</p>
          <p>{t("inspector.sc6")}</p>
        </div>
      </div>
    </div>
  );
}
