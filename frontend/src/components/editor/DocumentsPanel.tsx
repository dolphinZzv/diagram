import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Copy,
  FilePlus2,
  Files,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDocuments } from "@/lib/documents";
import { useDiagramActions } from "@/hooks/useDiagramActions";
import { useEditor } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { promptDialog } from "@/lib/dialog";
import { cn } from "@/lib/utils";

/**
 * Left navigation listing every stored diagram. Used as a persistent sidebar on
 * desktop and inside a drawer on phones / tablets. `onOpened` lets the mobile
 * drawer close after a diagram is picked.
 */
export function DocumentsPanel({
  onOpened,
  onCollapse,
}: { onOpened?: () => void; onCollapse?: () => void } = {}) {
  const t = useT();
  const items = useDocuments((s) => s.items);
  const loading = useDocuments((s) => s.loading);
  const loaded = useDocuments((s) => s.loaded);
  const error = useDocuments((s) => s.error);
  const refresh = useDocuments((s) => s.refresh);
  const { openDiagram, createDiagram, duplicateDiagram, deleteDiagram, renameDiagram } =
    useDiagramActions();
  const meta = useEditor((s) => s.meta);

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const onOpen = async (id: string) => {
    if (await openDiagram(id)) onOpened?.();
  };

  const onNew = async () => {
    if (await createDiagram()) onOpened?.();
  };

  const onRename = async (id: string, current: string) => {
    const name = await promptDialog({ title: t("docs.rename"), defaultValue: current });
    if (name && name.trim() && name.trim() !== current) await renameDiagram(id, name.trim());
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-2.5">
        <Files className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold">{t("docs.title")}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("docs.refresh")}
            title={t("docs.refresh")}
            onClick={() => void refresh()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("docs.new")}
            title={t("docs.new")}
            onClick={() => void onNew()}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </Button>
          {onCollapse ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("panel.collapse")}
              title={t("panel.collapse")}
              onClick={onCollapse}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("docs.search")}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading && !loaded ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("docs.loading")}
          </div>
        ) : error && items.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground">
            <p>{t("docs.listFail")}</p>
            <Button variant="outline" size="sm" className="h-7" onClick={() => void refresh()}>
              {t("docs.retry")}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
            <Files className="h-6 w-6 opacity-40" />
            <p className="px-2 text-xs">{items.length === 0 ? t("docs.empty") : t("docs.noMatch")}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((it) => {
              const active = meta.id === it.id;
              // The open diagram's live name wins over the cached list entry.
              const name = active ? meta.name : it.name;
              return (
                <li key={it.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md border px-2 py-1.5",
                      active ? "border-primary/40 bg-accent" : "border-transparent hover:bg-accent"
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void onOpen(it.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium">{name}</span>
                        {active && !meta.saved ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        ) : null}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {new Date(it.updatedAt).toLocaleString()}
                      </div>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                          aria-label={t("toolbar.more")}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void onRename(it.id, it.name)}>
                          <Pencil className="h-4 w-4" /> {t("docs.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void duplicateDiagram(it.id, `${it.name} ${t("docs.copySuffix")}`)
                          }
                        >
                          <Copy className="h-4 w-4" /> {t("docs.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => void deleteDiagram(it.id, it.name)}
                        >
                          <Trash2 className="h-4 w-4" /> {t("docs.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {meta.id === null ? (
          <div className="mt-1 rounded-md border border-dashed px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium">{meta.name || t("topbar.untitled")}</span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            </div>
            <div className="text-[10px] text-muted-foreground">{t("docs.unsaved")}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
