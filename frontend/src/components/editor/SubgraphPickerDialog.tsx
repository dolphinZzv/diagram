import { useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Boxes, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDocuments } from "@/lib/documents";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";

/** Pick an existing diagram to embed as a subgraph node on the canvas. */
export function SubgraphPickerDialog() {
  const t = useT();
  const open = useUi((s) => s.subgraphPickerOpen);
  const setOpen = useUi((s) => s.setSubgraphPickerOpen);
  const items = useDocuments((s) => s.items);
  const loading = useDocuments((s) => s.loading);
  const loaded = useDocuments((s) => s.loaded);
  const refresh = useDocuments((s) => s.refresh);
  const addSubgraphNode = useEditor((s) => s.addSubgraphNode);
  const currentId = useEditor((s) => s.meta.id);
  const { screenToFlowPosition } = useReactFlow();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open && !loaded) void refresh();
  }, [open, loaded, refresh]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.id !== currentId)
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true));
  }, [items, currentId, query]);

  const insert = (id: string, name: string) => {
    const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 400) / 2,
    });
    addSubgraphNode(id, name, { x: center.x - 110, y: center.y - 75 });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> {t("subgraph.pickerTitle")}
          </DialogTitle>
          <DialogDescription>{t("subgraph.pickerDesc")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t("docs.search")}
            className="h-9 pl-7 text-sm"
          />
        </div>

        <ScrollArea className="h-[320px] pr-3">
          {loading && !loaded ? (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("docs.loading")}
            </div>
          ) : list.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
              <Boxes className="h-6 w-6 opacity-40" />
              <span>{items.length <= 1 ? t("subgraph.pickerEmpty") : t("docs.noMatch")}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {list.map((it) => (
                <Button
                  key={it.id}
                  variant="ghost"
                  className="h-auto w-full justify-start px-3 py-2 text-left"
                  onClick={() => insert(it.id, it.name)}
                >
                  <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{it.name}</span>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
