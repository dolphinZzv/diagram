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
import { confirmDialog } from "@/lib/dialog";
import { describeError } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ORIGIN_STYLES: Record<string, string> = {
  create: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  auto: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  manual: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  restore: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function VersionHistory({ open, onOpenChange }: Props) {
  const t = useT();
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
      toast.error(t("version.historyFail"), describeError(e));
    } finally {
      setLoading(false);
    }
  }, [metaId, t]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const applyDoc = useCallback(
    (nodes: unknown[], edges: unknown[], viewport?: { x: number; y: number; zoom: number }) => {
      const n = normalizeNodes(nodes);
      const e = normalizeEdges(edges);
      loadDoc(n, e);
      setTimeout(() => {
        if (viewport) setViewport(viewport);
        else fitView({ padding: 0.3 });
      }, 40);
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
        toast.success(t("version.loaded", { v: v.version }), t("version.loadedDesc"));
      } catch (e) {
        toast.error(t("version.loadFail"), describeError(e));
      } finally {
        setBusy(null);
      }
    },
    [metaId, applyDoc, setMeta, onOpenChange, t]
  );

  const onRestore = useCallback(
    async (v: DiagramVersion) => {
      if (!metaId) return;
      if (!(await confirmDialog({ title: t("version.confirmRestore", { v: v.version }), destructive: true }))) return;
      setBusy(v.version);
      try {
        const res = await api.restoreVersion(metaId, v.version);
        applyDoc(res.diagram.data.nodes ?? [], res.diagram.data.edges ?? [], res.diagram.data.viewport);
        setMeta({ saved: true });
        onOpenChange(false);
        toast.success(t("version.restored", { v: v.version }), t("version.restoredDesc", { nv: res.version.version }));
      } catch (e) {
        toast.error(t("version.restoreFail"), describeError(e));
      } finally {
        setBusy(null);
      }
    },
    [metaId, applyDoc, setMeta, onOpenChange, t]
  );

  const onDelete = useCallback(
    async (v: DiagramVersion) => {
      if (!metaId) return;
      if (!(await confirmDialog({ title: t("version.confirmDelete", { v: v.version }), destructive: true }))) return;
      try {
        await api.removeVersion(metaId, v.version);
        toast.success(t("version.deletedV", { v: v.version }));
        refresh();
      } catch (e) {
        toast.error(t("version.deleteFail"), describeError(e));
      }
    },
    [metaId, refresh, t]
  );

  const onSnapshot = useCallback(async () => {
    if (!metaId) return;
    if (!metaSaved) toast.info(t("version.saveFirst"), t("version.saveFirstDesc"));
    try {
      const v = await api.createVersion(metaId, label.trim() || t("version.snapshot"));
      setLabel("");
      toast.success(t("version.snapshotCreated", { v: v.version }));
      refresh();
    } catch (e) {
      toast.error(t("version.snapshotFail"), describeError(e));
    }
  }, [metaId, metaSaved, label, refresh, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> {t("version.title")}
          </DialogTitle>
          <DialogDescription>{t("version.desc")}</DialogDescription>
        </DialogHeader>

        {!metaId ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <History className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t("version.needSave")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t("version.snapshotPlaceholder")}
                className="h-9 text-xs"
              />
              <Button size="sm" className="h-9 shrink-0" onClick={onSnapshot}>
                <Camera className="h-4 w-4" /> {t("version.snapshot")}
              </Button>
            </div>

            <Separator />

            <ScrollArea className="h-[380px] pr-3">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("version.loading")}
                </div>
              ) : versions.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  {t("version.empty")}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {versions.map((v, idx) => {
                    const originLabel =
                      {
                        create: t("version.originCreate"),
                        auto: t("version.originAuto"),
                        manual: t("version.originManual"),
                        restore: t("version.originRestore"),
                      }[v.origin] ?? v.origin;
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">v{v.version}</span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px]",
                                ORIGIN_STYLES[v.origin] ?? ORIGIN_STYLES.create
                              )}
                            >
                              {originLabel}
                            </span>
                            {isLatest ? (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                {t("version.latest")}
                              </span>
                            ) : null}
                            {v.label ? (
                              <span className="truncate text-xs text-muted-foreground">{v.label}</span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatTime(v.createdAt)} · {t("version.scale", { nodes: v.nodeCount, edges: v.edgeCount })}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("version.load")}
                            aria-label={t("version.load")}
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
                            title={t("version.restore")}
                            aria-label={t("version.restore")}
                            disabled={busy === v.version}
                            onClick={() => onRestore(v)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title={t("version.delete")}
                            aria-label={t("version.delete")}
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
