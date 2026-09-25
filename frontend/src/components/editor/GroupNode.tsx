import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { useT } from "@/lib/i18n";

type GroupNodeType = Node<{ label?: string }, "group">;

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const setNodeDimensions = useEditor((s) => s.setNodeDimensions);
  const t = useT();

  return (
    <div className="relative h-full w-full">
      <NodeResizer
        minWidth={80}
        minHeight={60}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-primary !bg-background"
        onResizeEnd={(_e, params) => {
          setNodeDimensions(id, Math.round(params.width), Math.round(params.height));
        }}
      />
      <div className="pointer-events-none h-full w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-100/40 dark:border-slate-600 dark:bg-slate-800/30" />
      <div className="pointer-events-none absolute -top-5 left-1 text-xs font-medium text-muted-foreground">
        {data.label || t("inspector.groupLabel")}
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
