import { useCallback } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import {
  Pencil,
  Copy,
  CopyPlus,
  Trash2,
  ChevronsUp,
  ChevronsDown,
  Group as GroupIcon,
  Ungroup as UngroupIcon,
  Lock as LockIcon,
  LockOpen,
  ClipboardPaste,
  Maximize2,
  ZoomIn,
  MousePointer2,
  CornerDownRight,
  Plus,
  Network,
  LayoutDashboard,
  Palette as PaletteIcon,
  Send,
  Sparkles,
  PackagePlus,
  Package,
  Play,
} from "lucide-react";
import { useEditor } from "@/lib/store";
import { isCompactLayout, useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { DIAGRAM_PALETTES } from "@/lib/palettes";
import { exportMermaid, copyImageToClipboard } from "@/lib/exporter";
import { toMermaid } from "@/lib/mermaid";
import { copyText } from "@/lib/clipboard";
import { presentationOrder } from "@/lib/presentation";
import { toast } from "@/lib/toast";
import type { CtxItem } from "./ContextMenu";

export type SelectionKind = "node" | "edge" | "pane" | "multi";

/**
 * Single source of truth for the actions available on the current selection.
 * Used by the canvas context menu, the floating selection toolbar and the
 * contextual action bar in the header.
 */
export function useSelectionMenu() {
  const t = useT();
  const { fitView, zoomTo, screenToFlowPosition } = useReactFlow();

  const openInspector = useCallback(
    (id: string) => {
      useEditor.getState().setSelection([id]);
      if (isCompactLayout()) useUi.getState().setInspectorOpen(true);
    },
    []
  );

  return useCallback(
    (kind: SelectionKind, id?: string): (CtxItem | "separator")[] => {
      const s = useEditor.getState();
      const theme = "light";
      const select = () => {
        if (id) s.setSelection([id]);
      };

      if (kind === "node" && id) {
        const node = s.nodes.find((n) => n.id === id);
        const locked = !!(node?.data as { locked?: boolean } | undefined)?.locked;
        const idSet = new Set(s.selectedIds.includes(id) ? s.selectedIds : [id]);
        const hasGroup = s.nodes.some(
          (n) => idSet.has(n.id) && (n.type === "group" || n.type === "lane")
        );
        return [
          { label: t("ctx.edit"), icon: <Pencil className="h-4 w-4" />, onClick: () => openInspector(id) },
          "separator",
          { label: t("ctx.copy"), icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl C", onClick: () => { select(); s.copySelected(); } },
          { label: t("ctx.duplicate"), icon: <CopyPlus className="h-4 w-4" />, shortcut: "Ctrl D", onClick: () => { select(); s.duplicateSelected(); } },
          { label: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, danger: true, shortcut: "Del", onClick: () => { select(); s.removeSelected(); } },
          "separator",
          { label: t("ctx.front"), icon: <ChevronsUp className="h-4 w-4" />, onClick: () => { select(); s.bringToFront(); } },
          { label: t("ctx.back"), icon: <ChevronsDown className="h-4 w-4" />, onClick: () => { select(); s.sendToBack(); } },
          "separator",
          { label: t("ctx.group"), icon: <GroupIcon className="h-4 w-4" />, shortcut: "Ctrl G", onClick: () => s.groupSelected() },
          { label: t("ctx.ungroup"), icon: <UngroupIcon className="h-4 w-4" />, disabled: !hasGroup, onClick: () => s.ungroupSelected() },
          { label: t("command.laneGroup"), icon: <GroupIcon className="h-4 w-4" />, onClick: () => s.groupSelected("lane") },
          { label: t("comp.save"), icon: <PackagePlus className="h-4 w-4" />, onClick: () => useUi.getState().setSaveComponentOpen(true) },
          "separator",
          { label: t("mindmap.addChild"), icon: <CornerDownRight className="h-4 w-4" />, shortcut: "Tab", onClick: () => { select(); s.addChildNode(id); } },
          { label: t("mindmap.addSibling"), icon: <Plus className="h-4 w-4" />, shortcut: "Enter", onClick: () => { select(); s.addSiblingNode(id); } },
          ...(node?.type === "lifeline"
            ? ([
                {
                  label: t("seq.addMessage"),
                  icon: <Send className="h-4 w-4" />,
                  onClick: () => useUi.getState().openMessageDialog(id),
                } as CtxItem,
                { label: t("seq.addParticipant"), icon: <Plus className="h-4 w-4" />, onClick: () => s.addParticipant() },
              ] as (CtxItem | "separator")[])
            : []),
          "separator",
          locked
            ? { label: t("ctx.unlock"), icon: <LockOpen className="h-4 w-4" />, onClick: () => { select(); s.lockSelected(false); } }
            : { label: t("ctx.lock"), icon: <LockIcon className="h-4 w-4" />, onClick: () => { select(); s.lockSelected(true); } },
        ];
      }

      if (kind === "edge" && id) {
        return [
          { label: t("ctx.edit"), icon: <Pencil className="h-4 w-4" />, onClick: () => openInspector(id) },
          "separator",
          { label: t("ctx.copy"), icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl C", onClick: () => { select(); s.copySelected(); } },
          { label: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, danger: true, shortcut: "Del", onClick: () => { select(); s.removeSelected(); } },
        ];
      }

      if (kind === "multi") {
        const idSet = new Set(s.selectedIds);
        const hasGroup = s.nodes.some(
          (n) => idSet.has(n.id) && (n.type === "group" || n.type === "lane")
        );
        const anyLocked = s.nodes.some(
          (n) => idSet.has(n.id) && (n.data as { locked?: boolean }).locked
        );
        return [
          { label: t("ctx.copy"), icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl C", onClick: () => s.copySelected() },
          { label: t("ctx.duplicate"), icon: <CopyPlus className="h-4 w-4" />, shortcut: "Ctrl D", onClick: () => s.duplicateSelected() },
          { label: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, danger: true, shortcut: "Del", onClick: () => s.removeSelected() },
          "separator",
          { label: t("ctx.group"), icon: <GroupIcon className="h-4 w-4" />, shortcut: "Ctrl G", onClick: () => s.groupSelected() },
          { label: t("ctx.ungroup"), icon: <UngroupIcon className="h-4 w-4" />, disabled: !hasGroup, onClick: () => s.ungroupSelected() },
          { label: t("command.laneGroup"), icon: <GroupIcon className="h-4 w-4" />, onClick: () => s.groupSelected("lane") },
          { label: t("comp.save"), icon: <PackagePlus className="h-4 w-4" />, onClick: () => useUi.getState().setSaveComponentOpen(true) },
          "separator",
          { label: t("ctx.front"), icon: <ChevronsUp className="h-4 w-4" />, onClick: () => s.bringToFront() },
          { label: t("ctx.back"), icon: <ChevronsDown className="h-4 w-4" />, onClick: () => s.sendToBack() },
          "separator",
          anyLocked
            ? { label: t("ctx.unlock"), icon: <LockOpen className="h-4 w-4" />, onClick: () => s.lockSelected(false) }
            : { label: t("ctx.lock"), icon: <LockIcon className="h-4 w-4" />, onClick: () => s.lockSelected(true) },
        ];
      }

      // pane
      void screenToFlowPosition;
      return [
        { label: t("ctx.paste"), icon: <ClipboardPaste className="h-4 w-4" />, shortcut: "Ctrl V", disabled: !s.clipboard, onClick: () => s.paste() },
        { label: t("ctx.selectAll"), icon: <MousePointer2 className="h-4 w-4" />, shortcut: "Ctrl A", onClick: () => s.selectAll() },
        "separator",
        { label: t("seq.addParticipant"), icon: <Plus className="h-4 w-4" />, onClick: () => s.addParticipant() },
        { label: t("command.addLane"), icon: <Plus className="h-4 w-4" />, onClick: () => s.addLane() },
        { label: t("comp.manage"), icon: <Package className="h-4 w-4" />, onClick: () => useUi.getState().setComponentLibraryOpen(true) },
        "separator",
        { label: t("command.autoLayoutTB"), icon: <LayoutDashboard className="h-4 w-4" />, onClick: () => s.autoLayout("TB") },
        { label: t("command.autoLayoutLR"), icon: <LayoutDashboard className="h-4 w-4" />, onClick: () => s.autoLayout("LR") },
        { label: t("command.mindMap"), icon: <Network className="h-4 w-4" />, onClick: () => s.mindMapLayout() },
        {
          label: t("present.start"),
          icon: <Play className="h-4 w-4" />,
          onClick: () => {
            const order = presentationOrder(s.nodes, s.edges);
            if (order.length) useUi.getState().startPresentation(order);
          },
        },
        "separator",
        ...Object.entries(DIAGRAM_PALETTES).map(([key, p]) => ({
          label: `${t("command.palette")}: ${t(p.nameKey)}`,
          icon: <PaletteIcon className="h-4 w-4" />,
          onClick: () => s.restyleAll(key),
        })),
        "separator",
        { label: t("command.beautify"), icon: <Sparkles className="h-4 w-4" />, onClick: () => s.beautify("ocean") },
        { label: t("command.exportMermaid"), onClick: () => exportMermaid(toMermaid(s.nodes, s.edges), s.meta.name || "diagram") },
        {
          label: t("command.copyMermaid"),
          onClick: async () => {
            const ok = await copyText(toMermaid(s.nodes, s.edges));
            if (ok) toast.success(t("share.linkCopied"));
          },
        },
        {
          label: t("command.copyImage"),
          onClick: async () => {
            const r = await copyImageToClipboard(s.nodes, s.edges, theme);
            toast.success(r === "copied" ? t("command.imageCopied") : t("topbar.exportedImage", { format: "PNG" }));
          },
        },
        "separator",
        { label: t("ctx.fitView"), icon: <Maximize2 className="h-4 w-4" />, onClick: () => fitView({ padding: 0.25 }) },
        { label: t("ctx.zoomReset"), icon: <ZoomIn className="h-4 w-4" />, onClick: () => zoomTo(1) },
      ];
    },
    [t, openInspector, fitView, zoomTo, screenToFlowPosition]
  );
}

/** Convenience: does a selection consist of a single node? */
export function singleNodeOf(nodes: Node[], selectedIds: string[]): Node | undefined {
  const sel = nodes.filter((n) => selectedIds.includes(n.id));
  return sel.length === 1 ? sel[0] : undefined;
}
