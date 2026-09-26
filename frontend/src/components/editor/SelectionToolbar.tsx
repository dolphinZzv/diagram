import { useMemo, useState } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import {
  Pencil,
  Copy,
  CopyPlus,
  Trash2,
  Group as GroupIcon,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/lib/store";
import { useUi, useIsCompactLayout } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { ContextMenu } from "./ContextMenu";
import { ActionSheet } from "./ActionSheet";
import { useSelectionMenu, type SelectionKind } from "./useSelectionMenu";

function sizeOf(n: Node): { w: number; h: number } {
  const d = n.data as { width?: number; height?: number };
  return {
    w: (n.style?.width as number) || d.width || 120,
    h: (n.style?.height as number) || d.height || 60,
  };
}

/** Floating quick-action bar shown next to the current selection. */
export function SelectionToolbar() {
  const t = useT();
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const selectedIds = useEditor((s) => s.selectedIds);
  const presentation = useUi((s) => s.presentation.active);
  const buildItems = useSelectionMenu();
  const { flowToScreenPosition } = useReactFlow();

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Must run before any early return (Rules of Hooks).
  const compact = useIsCompactLayout();

  const target = useMemo(() => {
    const selNodes = nodes.filter((n) => selectedIds.includes(n.id) && n.type !== "group" && n.type !== "lane");
    const selEdges = edges.filter((e) => selectedIds.includes(e.id));

    let kind: SelectionKind | null = null;
    let id: string | undefined;
    let point: { x: number; y: number } | null = null;

    if (selNodes.length > 1) {
      kind = "multi";
      const boxes = selNodes.map((n) => ({ n, s: sizeOf(n) }));
      const minY = Math.min(...boxes.map((b) => b.n.position.y));
      const minX = Math.min(...boxes.map((b) => b.n.position.x));
      const maxX = Math.max(...boxes.map((b) => b.n.position.x + b.s.w));
      point = { x: (minX + maxX) / 2, y: minY };
    } else if (selNodes.length === 1) {
      kind = "node";
      id = selNodes[0].id;
      const s = sizeOf(selNodes[0]);
      point = { x: selNodes[0].position.x + s.w / 2, y: selNodes[0].position.y };
    } else if (selEdges.length === 1) {
      kind = "edge";
      id = selEdges[0].id;
      const src = nodes.find((n) => n.id === selEdges[0].source);
      const tgt = nodes.find((n) => n.id === selEdges[0].target);
      if (src && tgt) {
        const a = { x: src.position.x + sizeOf(src).w / 2, y: src.position.y + sizeOf(src).h / 2 };
        const b = { x: tgt.position.x + sizeOf(tgt).w / 2, y: tgt.position.y + sizeOf(tgt).h / 2 };
        point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    } else if (selEdges.length > 1) {
      kind = "multi";
      const src = nodes.find((n) => n.id === selEdges[0].source);
      if (src) point = { x: src.position.x, y: src.position.y };
    }

    if (!kind || !point) return null;
    return { kind, id, screen: flowToScreenPosition(point) };
  }, [nodes, edges, selectedIds, flowToScreenPosition]);

  if (!target || presentation) return null;

  const s = useEditor.getState();

  const quick =
    target.kind === "node"
      ? [
          { title: t("ctx.edit"), icon: <Pencil className="h-4 w-4" />, onClick: () => { if (compact) useUi.getState().setInspectorOpen(true); } },
          { title: t("ctx.copy"), icon: <Copy className="h-4 w-4" />, onClick: () => s.copySelected() },
          { title: t("ctx.duplicate"), icon: <CopyPlus className="h-4 w-4" />, onClick: () => s.duplicateSelected() },
          { title: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, onClick: () => s.removeSelected(), danger: true },
        ]
      : target.kind === "multi"
        ? [
            { title: t("ctx.group"), icon: <GroupIcon className="h-4 w-4" />, onClick: () => s.groupSelected() },
            { title: t("ctx.duplicate"), icon: <CopyPlus className="h-4 w-4" />, onClick: () => s.duplicateSelected() },
            { title: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, onClick: () => s.removeSelected(), danger: true },
          ]
        : [
            { title: t("ctx.edit"), icon: <Pencil className="h-4 w-4" />, onClick: () => { if (compact) useUi.getState().setInspectorOpen(true); } },
            { title: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, onClick: () => s.removeSelected(), danger: true },
          ];

  return (
    <>
      <div
        className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-full pb-2"
        style={{ left: target.screen.x, top: target.screen.y - 8 }}
      >
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur">
          {quick.map((q) => (
            <Button
              key={q.title}
              variant="ghost"
              size="icon"
              className={q.danger ? "h-8 w-8 rounded-full text-destructive" : "h-8 w-8 rounded-full"}
              title={q.title}
              onClick={q.onClick}
            >
              {q.icon}
            </Button>
          ))}
          <div className="mx-0.5 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            title={t("toolbar.more")}
            onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {menu && !compact ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildItems(target.kind, target.id)}
          onClose={() => setMenu(null)}
        />
      ) : null}

      {compact ? (
        <ActionSheet
          open={!!menu}
          onOpenChange={(v) => {
            if (!v) setMenu(null);
          }}
          title={
            target.kind === "edge"
              ? t("action.edgeTitle")
              : target.kind === "multi"
                ? t("inspector.selected")
                : t("action.nodeTitle")
          }
          items={buildItems(target.kind, target.id)}
        />
      ) : null}
    </>
  );
}
