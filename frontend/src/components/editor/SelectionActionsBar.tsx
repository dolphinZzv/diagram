import { useMemo } from "react";
import { X } from "lucide-react";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { useSelectionMenu, type SelectionKind } from "./useSelectionMenu";
import { cn } from "@/lib/utils";
import type { CtxItem } from "./ContextMenu";

/** Contextual action bar shown under the header for the current selection. */
export function SelectionActionsBar() {
  const t = useT();
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const selectedIds = useEditor((s) => s.selectedIds);
  const presentation = useUi((s) => s.presentation.active);
  const buildItems = useSelectionMenu();

  const target = useMemo(() => {
    const selNodes = nodes.filter(
      (n) => selectedIds.includes(n.id) && n.type !== "group" && n.type !== "lane"
    );
    const selEdges = edges.filter((e) => selectedIds.includes(e.id));
    const count = selNodes.length + selEdges.length;
    if (selNodes.length > 1 || selEdges.length > 1) {
      return { kind: "multi" as SelectionKind, id: undefined as string | undefined, count };
    }
    if (selNodes.length === 1) return { kind: "node" as SelectionKind, id: selNodes[0].id, count };
    if (selEdges.length === 1) return { kind: "edge" as SelectionKind, id: selEdges[0].id, count };
    return null;
  }, [nodes, edges, selectedIds]);

  if (!target || presentation) return null;

  const items = buildItems(target.kind, target.id).filter(
    (i): i is CtxItem => i !== "separator"
  );

  return (
    <div className="no-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-2">
      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        {t("inspector.selected")} {target.count}
      </span>
      <div className="mx-1 h-5 w-px shrink-0 bg-border" />
      {items.map((it, i) => (
        <button
          key={`${it.label}-${i}`}
          type="button"
          disabled={it.disabled}
          onClick={it.onClick}
          title={it.shortcut ? `${it.label} (${it.shortcut})` : it.label}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
            it.danger && "text-destructive"
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => useEditor.getState().setSelection([])}
        title={t("inspector.cancel")}
        className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
      >
        <X className="h-3.5 w-3.5" /> {t("inspector.cancel")}
      </button>
    </div>
  );
}
