import { memo, useCallback } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { useT } from "@/lib/i18n";

type GroupNodeType = Node<{ label?: string }, "group">;

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const setNodeDimensions = useEditor((s) => s.setNodeDimensions);
  const t = useT();

  // Keep a stable reference so React Flow does not rebuild the resizer on every
  // render (which broke continuous touch resizing on mobile).
  const onResizeEnd = useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      setNodeDimensions(id, Math.round(params.width), Math.round(params.height));
    },
    [id, setNodeDimensions]
  );

  return (
    <div className="relative h-full w-full">
      <NodeResizer
        minWidth={80}
        minHeight={60}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-primary !bg-background"
        onResizeEnd={onResizeEnd}
      />
      <div className="pointer-events-none h-full w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-100/40 dark:border-slate-600 dark:bg-slate-800/30" />
      <div className="pointer-events-none absolute -top-5 left-1 text-xs font-medium text-muted-foreground">
        {data.label || t("inspector.groupLabel")}
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
