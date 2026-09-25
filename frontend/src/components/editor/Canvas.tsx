import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  SelectionMode,
  useReactFlow,
  type Node,
  type NodeChange,
  type EdgeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
} from "lucide-react";
import { nodeTypes, edgeTypes } from "./flow-types";
import { useEditor } from "@/lib/store";
import { ARCH_PRESETS, PRESET_SHAPES, buildIconNode } from "./ShapePalette";
import { ICON_PRESETS } from "./icons";
import { defaultNodeData, type ShapeType } from "@/lib/types";
import { uid } from "@/lib/id";
import { useTheme, canvasColors } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { isCompactLayout, useUi } from "@/lib/ui";
import { toMermaid } from "@/lib/mermaid";
import { DIAGRAM_PALETTES } from "@/lib/palettes";
import { exportMermaid, copyImageToClipboard } from "@/lib/exporter";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { ContextMenu, type CtxItem } from "./ContextMenu";
import { ActionSheet } from "./ActionSheet";
import { SequenceMessageDialog } from "./SequenceMessageDialog";
import { HelperLines } from "./HelperLines";
import { EmptyState } from "./EmptyState";

function nodeSize(n: Node): { w: number; h: number } {
  const d = n.data as { width?: number; height?: number };
  const w =
    (typeof n.measured?.width === "number" && n.measured.width) ||
    (typeof n.width === "number" && n.width) ||
    (typeof n.style?.width === "number" && n.style.width) ||
    d?.width ||
    120;
  const h =
    (typeof n.measured?.height === "number" && n.measured.height) ||
    (typeof n.height === "number" && n.height) ||
    (typeof n.style?.height === "number" && n.style.height) ||
    d?.height ||
    60;
  return { w, h };
}

type MenuState = { x: number; y: number; kind: "node" | "edge" | "pane"; id?: string } | null;

export function Canvas() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const selectedIds = useEditor((s) => s.selectedIds);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const setSelection = useEditor((s) => s.setSelection);
  const addNode = useEditor((s) => s.addNode);
  const addShapeNode = useEditor((s) => s.addShapeNode);
  const theme = useTheme((s) => s.theme);
  const colors = canvasColors(theme);
  const t = useT();
  const selectMode = useUi((s) => s.selectMode);
  const compact = isCompactLayout();

  const { screenToFlowPosition, getZoom, fitView, zoomTo } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [menu, setMenu] = useState<MenuState>(null);
  const [guides, setGuides] = useState<{ vertical?: number; horizontal?: number }>({});

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const s = nodeSize(n);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + s.w);
      maxY = Math.max(maxY, n.position.y + s.h);
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [nodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/diagram-kind");
      const value = event.dataTransfer.getData("application/diagram-value");
      if (!kind || !value) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      if (kind === "shape") {
        addShapeNode(value as ShapeType, { x: position.x - 60, y: position.y - 30 });
        return;
      }
      if (kind === "preset") {
        const preset = ARCH_PRESETS.find((p) => p.key === value);
        if (!preset) return;
        const shape = PRESET_SHAPES[value] ?? "rounded";
        const data = {
          ...defaultNodeData(shape),
          label: t(`arch.${value}`),
          fill: preset.fill,
          stroke: preset.stroke,
          textColor: preset.textColor,
        };
        const node: Node = {
          id: uid("n_"),
          type: "shape",
          position: { x: position.x - data.width / 2, y: position.y - data.height / 2 },
          data,
          style: { width: data.width, height: data.height },
          selected: true,
        };
        addNode(node);
        return;
      }
      if (kind === "icon") {
        const preset = ICON_PRESETS.find((p) => p.icon === value);
        const node = buildIconNode(value, preset ? t(preset.labelKey) : value, position);
        if (node) addNode(node);
      }
    },
    [addNode, addShapeNode, screenToFlowPosition, t]
  );

  const onSelectionChange = useCallback(
    ({ nodes: sn, edges: se }: OnSelectionChangeParams) => {
      setSelection([...sn.map((n) => n.id), ...se.map((e) => e.id)]);
    },
    [setSelection]
  );

  // Double-tap on compact layouts opens the properties drawer.
  const openInspector = useCallback(
    (id: string) => {
      setSelection([id]);
      if (compact) useUi.getState().setInspectorOpen(true);
    },
    [setSelection, compact]
  );

  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const handleTap = useCallback(
    (id: string) => {
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && prev.id === id && now - prev.t < 320) {
        lastTap.current = null;
        openInspector(id);
        return;
      }
      lastTap.current = { id, t: now };
    },
    [openInspector]
  );

  // ---- smart alignment guides + snapping ----
  const onNodeDragStart = useCallback(() => setGuides({}), []);

  const onNodeDrag = useCallback(
    (_event: unknown, node: Node) => {
      if (node.parentId) {
        setGuides({});
        return;
      }
      const threshold = 8 / Math.max(getZoom(), 0.1);
      const size = nodeSize(node);
      const xs = [node.position.x, node.position.x + size.w / 2, node.position.x + size.w];
      const ys = [node.position.y, node.position.y + size.h / 2, node.position.y + size.h];

      let bestX: { delta: number; line: number } | null = null;
      let bestY: { delta: number; line: number } | null = null;

      for (const other of useEditor.getState().nodes) {
        if (other.id === node.id || other.parentId) continue;
        const os = nodeSize(other);
        const ox = [other.position.x, other.position.x + os.w / 2, other.position.x + os.w];
        const oy = [other.position.y, other.position.y + os.h / 2, other.position.y + os.h];
        for (const a of xs) {
          for (const b of ox) {
            const d = b - a;
            if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.delta))) {
              bestX = { delta: d, line: b };
            }
          }
        }
        for (const a of ys) {
          for (const b of oy) {
            const d = b - a;
            if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.delta))) {
              bestY = { delta: d, line: b };
            }
          }
        }
      }

      if (bestX || bestY) {
        const store = useEditor.getState();
        store.setNodes(
          store.nodes.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  position: {
                    x: n.position.x + (bestX?.delta ?? 0),
                    y: n.position.y + (bestY?.delta ?? 0),
                  },
                }
              : n
          )
        );
      }
      setGuides({ vertical: bestX?.line, horizontal: bestY?.line });
    },
    [getZoom]
  );

  const onNodeDragStop = useCallback(() => setGuides({}), []);

  // ---- context menu ----
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (!selectedIds.includes(node.id)) setSelection([node.id]);
      setMenu({ x: event.clientX, y: event.clientY, kind: "node", id: node.id });
    },
    [selectedIds, setSelection]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: { id: string }) => {
      event.preventDefault();
      if (!selectedIds.includes(edge.id)) setSelection([edge.id]);
      setMenu({ x: event.clientX, y: event.clientY, kind: "edge", id: edge.id });
    },
    [selectedIds, setSelection]
  );

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, kind: "pane" });
  }, []);

  // Long-press (touch/pen) opens the bottom action sheet.
  const startLongPress = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse") return;
    const el = event.target as Element | null;
    if (!el || typeof el.closest !== "function") return;
    const nodeEl = el.closest(".react-flow__node") as HTMLElement | null;
    const edgeEl = el.closest(".react-flow__edge") as HTMLElement | null;
    const paneEl = el.closest(".react-flow__pane") as HTMLElement | null;
    let kind: "node" | "edge" | "pane" = "pane";
    let id: string | undefined;
    if (nodeEl) {
      kind = "node";
      id = nodeEl.getAttribute("data-id") ?? undefined;
    } else if (edgeEl) {
      kind = "edge";
      id = edgeEl.getAttribute("data-id") ?? undefined;
    } else if (!paneEl) {
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    let timer = 0;
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };
    function onMove(ev: PointerEvent) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) cleanup();
    }
    timer = window.setTimeout(() => {
      cleanup();
      const editor = useEditor.getState();
      if (kind === "node" && id) {
        editor.setSelection([id]);
        useUi.getState().openActionSheet("node", id);
      } else if (kind === "edge" && id) {
        editor.setSelection([id]);
        useUi.getState().openActionSheet("edge", id);
      } else {
        useUi.getState().openActionSheet("pane");
      }
    }, 480);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  }, []);

  const buildItems = useCallback(
    (kind: "node" | "edge" | "pane", id?: string): (CtxItem | "separator")[] => {
      const s = useEditor.getState();
    const selection = id && s.selectedIds.includes(id) ? s.selectedIds : id ? [id] : [];
    const select = () => {
      if (id) s.setSelection([id]);
    };

    if (kind === "node" && id) {
      const node = s.nodes.find((n) => n.id === id);
      const locked = !!(node?.data as { locked?: boolean } | undefined)?.locked;
      const idSet = new Set(selection);
      const hasGroup = s.nodes.some((n) => idSet.has(n.id) && n.type === "group");
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
        { label: t("ctx.group"), icon: <GroupIcon className="h-4 w-4" />, shortcut: "Ctrl G", onClick: () => { s.groupSelected(); } },
        { label: t("ctx.ungroup"), icon: <UngroupIcon className="h-4 w-4" />, disabled: !hasGroup, onClick: () => s.ungroupSelected() },
        "separator",
        { label: t("mindmap.addChild"), icon: <CornerDownRight className="h-4 w-4" />, shortcut: "Tab", onClick: () => { select(); s.addChildNode(id); } },
        { label: t("mindmap.addSibling"), icon: <Plus className="h-4 w-4" />, shortcut: "Enter", onClick: () => { select(); s.addSiblingNode(id); } },
        ...(node?.type === "lifeline"
          ? [
              {
                label: t("seq.addMessage"),
                icon: <Send className="h-4 w-4" />,
                onClick: () => useUi.getState().openMessageDialog(id),
              } as CtxItem,
              { label: t("seq.addParticipant"), icon: <Plus className="h-4 w-4" />, onClick: () => s.addParticipant() },
            ]
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
        { label: t("ctx.delete"), icon: <Trash2 className="h-4 w-4" />, danger: true, shortcut: "Del", onClick: () => { select(); s.removeSelected(); } },
      ];
    }

    return [
      { label: t("ctx.paste"), icon: <ClipboardPaste className="h-4 w-4" />, shortcut: "Ctrl V", disabled: !s.clipboard, onClick: () => s.paste() },
      { label: t("ctx.selectAll"), icon: <MousePointer2 className="h-4 w-4" />, shortcut: "Ctrl A", onClick: () => s.selectAll() },
      "separator",
      {
        label: t("seq.addParticipant"),
        icon: <Plus className="h-4 w-4" />,
        onClick: () => {
          s.addParticipant();
          if (compact) useUi.getState().setInspectorOpen(true);
        },
      },
      "separator",
      { label: t("command.autoLayoutTB"), icon: <LayoutDashboard className="h-4 w-4" />, onClick: () => s.autoLayout("TB") },
      { label: t("command.autoLayoutLR"), icon: <LayoutDashboard className="h-4 w-4" />, onClick: () => s.autoLayout("LR") },
      { label: t("command.mindMap"), icon: <Network className="h-4 w-4" />, onClick: () => s.mindMapLayout() },
      "separator",
      ...Object.entries(DIAGRAM_PALETTES).map(([key, p]) => ({
        label: `${t("command.palette")}: ${t(p.nameKey)}`,
        icon: <PaletteIcon className="h-4 w-4" />,
        onClick: () => s.restyleAll(key),
      })),
      "separator",
      {
        label: t("command.exportMermaid"),
        onClick: () => exportMermaid(toMermaid(s.nodes, s.edges), s.meta.name || "diagram"),
      },
      {
        label: t("command.copyMermaid"),
        onClick: async () => {
          const ok = await copyText(toMermaid(s.nodes, s.edges));
          if (ok) toast.success(t("share.linkCopied"));
        },
      },
      "separator",
      {
        label: t("command.beautify"),
        icon: <Sparkles className="h-4 w-4" />,
        onClick: () => s.beautify("ocean"),
      },
      {
        label: t("command.sketch"),
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => useUi.getState().toggleSketch(),
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
    [t, openInspector, fitView, zoomTo]
  );

  const menuItems = useMemo<(CtxItem | "separator")[]>(
    () => (menu ? buildItems(menu.kind, menu.id) : []),
    [menu, buildItems]
  );
  const actionSheet = useUi((s) => s.actionSheet);
  const closeActionSheet = useUi((s) => s.closeActionSheet);

  const showEmpty = nodes.length === 0 && edges.length === 0;

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onPointerDown={startLongPress}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as (c: NodeChange<Node>[]) => void}
        onEdgesChange={onEdgesChange as (c: EdgeChange[]) => void}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={(_, n) => handleTap(n.id)}
        onEdgeClick={(_, e) => handleTap(e.id)}
        onNodeDoubleClick={(_, n) => openInspector(n.id)}
        onEdgeDoubleClick={(_, e) => openInspector(e.id)}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={compact ? selectMode : true}
        panOnDrag={compact ? !selectMode : [1, 2]}
        panActivationKeyCode="Space"
        panOnScroll={!compact}
        selectionMode={SelectionMode.Partial}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        snapToGrid
        snapGrid={[10, 10]}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={4}
        colorMode={theme}
        defaultEdgeOptions={{ type: "custom" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color={colors.dots} />
        <Controls className="!rounded-md !border !bg-background !shadow" showInteractive={false} />
        <MiniMap
          className="!rounded-md !border"
          pannable
          zoomable
          nodeStrokeWidth={3}
          maskColor={colors.minimapMask}
          nodeColor={(n) => (n.data?.fill as string) || "#e2e8f0"}
        />
        <HelperLines
          vertical={guides.vertical}
          horizontal={guides.horizontal}
          minX={bounds.minX}
          minY={bounds.minY}
          width={bounds.width}
          height={bounds.height}
        />
      </ReactFlow>

      {showEmpty ? <EmptyState /> : null}

      {menu ? <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} /> : null}

      {actionSheet.open ? (
        <ActionSheet
          open={actionSheet.open}
          onOpenChange={(v) => {
            if (!v) closeActionSheet();
          }}
          title={
            actionSheet.kind === "node"
              ? t("action.nodeTitle")
              : actionSheet.kind === "edge"
                ? t("action.edgeTitle")
                : t("action.canvasTitle")
          }
          items={buildItems(actionSheet.kind, actionSheet.id)}
        />
      ) : null}

      <SequenceMessageDialog />
    </div>
  );
}
