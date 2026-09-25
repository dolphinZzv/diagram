import { useCallback, useEffect, useState } from "react";
import { Camera, Eye, History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useReactFlow } from "@xyflow/react";
import { api, type DiagramVersion } from "@/lib/api";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { useEditor } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ORIGIN_LABELS: Record<string, { text: string; className: string }> = {
  create: { text: "创建", className: "bg-slate-100 text-slate-700" },
  auto: { text: "自动", className: "bg-blue-50 text-blue-700" },
  manual: { text: "手动", className: "bg-green-50 text-green-700" },
  restore: { text: "恢复", className: "bg-amber-50 text-amber-700" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function VersionHistory({ open, onOpenChange }: Props) {
  const metaId = useEditor((s) => s.meta.id);
  const metaSaved = useEditor((s) => s.meta.saved);
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);
  const { fitView, setViewport } = useReactFlow();

  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [label, setLabel] = useState("");

  const refresh = useCallback(async () => {
    if (!metaId) {
      setVersions([]);
      return;
    }
    setLoading(true);
    try {
      setVersions(await api.listVersions(metaId));
    } catch (e) {
      toast.error("加载版本历史失败", String(e));
    } finally {
      setLoading(false);
    }
  }, [metaId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const applyDoc = useCallback(
    (
      nodes: unknown[],
      edges: unknown[],
      viewport?: { x: number; y: number; zoom: number }
    ) => {
      const n = normalizeNodes(nodes);
      const e = normalizeEdges(edges);
      loadDoc(n, e);
      setTimeout(() => {
        if (viewport) setViewport(viewport);
        else fitView({ padding: 0.3 });
      }, 40);
      return { n, e };
    },
    [loadDoc, fitView, setViewport]
  );

  const onLoad = useCallback(
    async (v: DiagramVersion) => {
      if (!metaId) return;
      setBusy(v.version);
      try {
        const full = await api.getVersion(metaId, v.version);
        applyDoc(full.data?.nodes ?? [], full.data?.edges ?? [], full.data?.viewport);
        setMeta({ saved: false });
        onOpenChange(false);
        toast.success(`已载入 v${v.version}`, "当前为未保存状态，确认后可保存");
      } catch (e) {
        toast.error("载入失败", String(e));
      } finally {
        setBusy(null);
      }
    },
    [metaId, applyDoc, setMeta, onOpenChange]
  );

  const onRestore = useCallback(
    async (v: DiagramVersion) => {
      if (!metaId) return;
      if (!confirm(`确定恢复到 v${v.version}？当前图纸内容将被替换。`)) return;
      setBusy(v.version);
      try {
        const res = await api.restoreVersion(metaId, v.version);
        applyDoc(res.diagram.data.nodes ?? [], res.diagram.data.edges ?? [], res.diagram.data.viewport);
        setMeta({ saved: true });
        onOpenChange(false);
        toast.success(`已恢复到 v${v.version}`, `生成新版本 v${res.version.version}`);
      } catch (e) {
        toast.error("恢复失败", String(e));
      } finally {
        setBusy(null);
      }
    },
    [metaId, applyDoc, setMeta, onOpenChange]
  );

  const onDelete = useCallback(
    async (v: DiagramVersion) => {
      if (!metaId) return;
      if (!confirm(`确定删除版本 v${v.version}？`)) return;
      try {
        await api.removeVersion(metaId, v.version);
        toast.success(`已删除 v${v.version}`);
        refresh();
      } catch (e) {
        toast.error("删除失败", String(e));
      }
    },
    [metaId, refresh]
  );

  const onSnapshot = useCallback(async () => {
    if (!metaId) return;
    if (!metaSaved) {
      toast.info("请先保存图纸", "保存后会自动生成版本");
    }
    try {
      const v = await api.createVersion(metaId, label.trim() || "手动快照");
      setLabel("");
      toast.success(`已创建版本 v${v.version}`);
      refresh();
    } catch (e) {
      toast.error("创建版本失败", String(e));
    }
  }, [metaId, metaSaved, label, refresh]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> 版本历史
          </DialogTitle>
          <DialogDescription>
            每次保存会自动记录一个版本（内容无变化时不重复记录），最多保留 100 个。
          </DialogDescription>
        </DialogHeader>

        {!metaId ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <History className="h-8 w-8 opacity-40" />
            <p className="text-sm">请先保存图纸，之后即可查看版本历史</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="快照备注（可选）"
                className="h-9 text-xs"
              />
              <Button size="sm" className="h-9 shrink-0" onClick={onSnapshot}>
                <Camera className="h-4 w-4" /> 创建快照
              </Button>
            </div>

            <Separator />

            <ScrollArea className="h-[380px] pr-3">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中…
                </div>
              ) : versions.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  暂无版本
                </div>
              ) : (
                <div className="space-y-1.5">
                  {versions.map((v, idx) => {
                    const origin = ORIGIN_LABELS[v.origin] ?? {
                      text: v.origin,
                      className: "bg-slate-100 text-slate-700",
                    };
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">v{v.version}</span>
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px]", origin.className)}>
                              {origin.text}
                            </span>
                            {isLatest ? (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                最新
                              </span>
                            ) : null}
                            {v.label ? (
                              <span className="truncate text-xs text-muted-foreground">{v.label}</span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatTime(v.createdAt)} · {v.nodeCount} 节点 / {v.edgeCount} 连线
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="载入到画布（不保存）"
                            disabled={busy === v.version}
                            onClick={() => onLoad(v)}
                          >
                            {busy === v.version ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="恢复到此版本并保存"
                            disabled={busy === v.version}
                            onClick={() => onRestore(v)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="删除此版本"
                            onClick={() => onDelete(v)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
