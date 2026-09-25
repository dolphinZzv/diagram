import { useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Download, Package, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
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
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import {
  componentBounds,
  componentsToJSON,
  parseComponentsJSON,
  useComponents,
  type ComponentDef,
} from "@/lib/components";
import { readJSONFile } from "@/lib/exporter";
import { toast } from "@/lib/toast";

function download(text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "diagram-components.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComponentLibraryDialog() {
  const t = useT();
  const open = useUi((s) => s.componentLibraryOpen);
  const setOpen = useUi((s) => s.setComponentLibraryOpen);
  const components = useComponents((s) => s.components);
  const update = useComponents((s) => s.update);
  const remove = useComponents((s) => s.remove);
  const replaceAll = useComponents((s) => s.replaceAll);
  const syncStatus = useComponents((s) => s.syncStatus);
  const syncFromServer = useComponents((s) => s.syncFromServer);
  const insertFragment = useEditor((s) => s.insertFragment);
  const { screenToFlowPosition } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? components.filter((c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
      : components;
    const map = new Map<string, ComponentDef[]>();
    for (const c of filtered) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [components, query]);

  const addAtCenter = (component: ComponentDef) => {
    const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 400) / 2,
    });
    const b = componentBounds(component);
    insertFragment(component.nodes, component.edges, {
      x: center.x - (b.minX + b.w / 2),
      y: center.y - (b.minY + b.h / 2),
    });
    setOpen(false);
    toast.success(t("comp.inserted"), component.name);
  };

  const onRename = (c: ComponentDef) => {
    const name = prompt(t("comp.name"), c.name);
    if (name && name.trim()) update(c.id, { name: name.trim() });
  };

  const onCategory = (c: ComponentDef) => {
    const category = prompt(t("comp.category"), c.category);
    if (category && category.trim()) update(c.id, { category: category.trim() });
  };

  const onDelete = (c: ComponentDef) => {
    if (confirm(t("comp.confirmDelete", { name: c.name }))) remove(c.id);
  };

  const onImport = async (file: File) => {
    try {
      const raw = await readJSONFile(file);
      const list = parseComponentsJSON(raw);
      // merge: keep existing, append new ids
      const existing = new Set(components.map((c) => c.id));
      replaceAll([...components, ...list.filter((c) => !existing.has(c.id))]);
      toast.success(t("comp.imported"), String(list.length));
    } catch (e) {
      toast.error(t("comp.importFail"), String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> {t("comp.title")}
          </DialogTitle>
          <DialogDescription>{t("comp.desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t("comp.search")}
            className="h-9 flex-1 text-sm"
          />
          <Button variant="outline" size="sm" className="h-9" onClick={() => download(componentsToJSON(components))}>
            <Download className="h-4 w-4" /> {t("comp.export")}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {t("comp.import")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            title={t("comp.cloud")}
            disabled={syncStatus === "syncing"}
            onClick={() => void syncFromServer()}
          >
            <RefreshCw className={syncStatus === "syncing" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("comp.sync")}
          </Button>
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setOpen(false);
              useUi.getState().setSaveComponentOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("comp.save")}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              syncStatus === "error" ? "bg-amber-500" : syncStatus === "syncing" ? "bg-blue-500" : "bg-green-500"
            }`}
          />
          {syncStatus === "syncing" ? t("comp.syncing") : syncStatus === "error" ? t("comp.syncError") : t("comp.cloud")}
        </div>

        <ScrollArea className="h-[46vh] pr-3">
          {components.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Package className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t("comp.empty")}</p>
              <p className="text-[11px]">{t("comp.emptyHint")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([category, list]) => (
                <div key={category}>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </div>
                  <div className="space-y-1.5">
                    {list.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{c.name}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {c.kind === "compound" ? t("comp.compound") : t("comp.single")}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {c.nodes.length} {t("inspector.nodesCount")} · {c.edges.length}{" "}
                            {t("inspector.edgesCount")}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => addAtCenter(c)}>
                            {t("comp.insert")}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t("comp.rename")} onClick={() => onRename(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t("comp.changeCategory")} onClick={() => onCategory(c)}>
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title={t("ctx.delete")} onClick={() => onDelete(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
