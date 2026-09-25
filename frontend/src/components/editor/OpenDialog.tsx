import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type DiagramListItem } from "@/lib/api";
import { useEditor } from "@/lib/store";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { useReactFlow } from "@xyflow/react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function OpenDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const [items, setItems] = useState<DiagramListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);
  const { fitView, setViewport } = useReactFlow();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.list());
    } catch (e) {
      toast.error(t("open.listFail"), String(e));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const onOpen = useCallback(
    async (id: string) => {
      try {
        const rec = await api.get(id);
        const nodes = normalizeNodes(rec.data.nodes ?? []);
        const edges = normalizeEdges(rec.data.edges ?? []);
        loadDoc(nodes, edges);
        setMeta({ id: rec.id, name: rec.name, description: rec.description, saved: true });
        onOpenChange(false);
        setTimeout(() => {
          if (rec.data.viewport) setViewport(rec.data.viewport);
          else fitView({ padding: 0.3 });
        }, 40);
        toast.success(t("open.opened"), rec.name);
      } catch (e) {
        toast.error(t("open.openFail"), String(e));
      }
    },
    [loadDoc, setMeta, onOpenChange, fitView, setViewport, t]
  );

  const onDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(t("open.confirmDelete", { name }))) return;
      try {
        await api.remove(id);
        toast.success(t("open.deleted"), name);
        refresh();
      } catch (e) {
        toast.error(t("open.deleteFail"), String(e));
      }
    },
    [refresh, t]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("open.title")}</DialogTitle>
          <DialogDescription>{t("open.desc")}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[380px] pr-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("open.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <FolderOpen className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t("open.empty")}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <button className="flex-1 text-left" onClick={() => onOpen(it.id)}>
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.description || t("open.noDesc")} · {t("open.updatedAt")}{" "}
                      {new Date(it.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDelete(it.id, it.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
