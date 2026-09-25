import { useMemo } from "react";
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Group as GroupIcon,
  Ungroup as UngroupIcon,
  Lock as LockIcon,
  LockOpen,
  PackagePlus,
  Trash2,
  X,
} from "lucide-react";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Arrange toolbar shown under the header while there is a selection. It focuses
 * on layout/alignment/layer tools — quick per-item actions live on the floating
 * toolbar next to the selection instead.
 */
export function SelectionActionsBar() {
  const t = useT();
  const nodes = useEditor((s) => s.nodes);
  const selectedIds = useEditor((s) => s.selectedIds);
  const presentation = useUi((s) => s.presentation.active);

  const sel = useMemo(
    () => nodes.filter((n) => selectedIds.includes(n.id) && n.type !== "group" && n.type !== "lane"),
    [nodes, selectedIds]
  );
  const count = selectedIds.length;
  if (count === 0 || presentation) return null;

  const nodeCount = sel.length;
  const anyLocked = sel.some((n) => (n.data as { locked?: boolean }).locked);
  const hasGroup = nodes.some(
    (n) => selectedIds.includes(n.id) && (n.type === "group" || n.type === "lane")
  );


  const Btn = ({
    title,
    onClick,
    disabled,
    danger,
    children,
  }: {
    title: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
        danger && "text-destructive"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="no-scrollbar flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-background px-2">
      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        {t("inspector.selected")} {count}
      </span>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      {/* align */}
      <Btn title={t("inspector.alignLeft")} disabled={nodeCount < 2} onClick={() => useEditor.getState().alignNodes("left")}>
        <AlignHorizontalJustifyStart className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.alignCenterH")} disabled={nodeCount < 2} onClick={() => useEditor.getState().alignNodes("hcenter")}>
        <AlignHorizontalJustifyCenter className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.alignRight")} disabled={nodeCount < 2} onClick={() => useEditor.getState().alignNodes("right")}>
        <AlignHorizontalJustifyEnd className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.alignTop")} disabled={nodeCount < 2} onClick={() => useEditor.getState().alignNodes("top")}>
        <AlignVerticalJustifyStart className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.alignCenterV")} disabled={nodeCount < 2} onClick={() => useEditor.getState().alignNodes("vcenter")}>
        <AlignVerticalJustifyCenter className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.alignBottom")} disabled={nodeCount < 2} onClick={() => useEditor.getState().alignNodes("bottom")}>
        <AlignVerticalJustifyEnd className="h-4 w-4" />
      </Btn>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      {/* distribute */}
      <Btn title={t("inspector.distH")} disabled={nodeCount < 3} onClick={() => useEditor.getState().distributeNodes("horizontal")}>
        <AlignHorizontalSpaceAround className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.distV")} disabled={nodeCount < 3} onClick={() => useEditor.getState().distributeNodes("vertical")}>
        <AlignVerticalSpaceAround className="h-4 w-4" />
      </Btn>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      {/* layer */}
      <Btn title={t("inspector.layerFront")} onClick={() => useEditor.getState().bringToFront()}>
        <ChevronsUp className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.layerForward")} onClick={() => useEditor.getState().bringForward()}>
        <ChevronUp className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.layerBackward")} onClick={() => useEditor.getState().sendBackward()}>
        <ChevronDown className="h-4 w-4" />
      </Btn>
      <Btn title={t("inspector.layerBack")} onClick={() => useEditor.getState().sendToBack()}>
        <ChevronsDown className="h-4 w-4" />
      </Btn>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      {/* container / lock / component / delete */}
      <Btn
        title={`${t("inspector.group")} (Ctrl G)`}
        disabled={nodeCount < 2}
        onClick={() => useEditor.getState().groupSelected()}
      >
        <GroupIcon className="h-4 w-4" />
      </Btn>
      <Btn
        title={t("inspector.ungroup")}
        disabled={!hasGroup}
        onClick={() => useEditor.getState().ungroupSelected()}
      >
        <UngroupIcon className="h-4 w-4" />
      </Btn>
      <Btn
        title={anyLocked ? t("inspector.unlock") : t("inspector.lock")}
        onClick={() => useEditor.getState().lockSelected(!anyLocked)}
      >
        {anyLocked ? <LockOpen className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
      </Btn>
      <Btn title={t("comp.save")} onClick={() => useUi.getState().setSaveComponentOpen(true)}>
        <PackagePlus className="h-4 w-4" />
      </Btn>
      <Btn title={t("ctx.delete")} danger onClick={() => useEditor.getState().removeSelected()}>
        <Trash2 className="h-4 w-4" />
      </Btn>

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
