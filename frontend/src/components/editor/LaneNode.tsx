import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { useT } from "@/lib/i18n";

type LaneNodeType = Node<{ label?: string }, "lane">;

function LaneNodeComponent({ id, data, selected }: NodeProps<LaneNodeType>) {
  const setNodeDimensions = useEditor((s) => s.setNodeDimensions);
  const t = useT();

  return (
    <div className="relative h-full w-full">
      <NodeResizer
        minWidth={160}
        minHeight={80}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-primary !bg-background"
        onResizeEnd={(_e, params) => {
          setNodeDimensions(id, Math.round(params.width), Math.round(params.height));
        }}
      />
      <div className="pointer-events-none h-full w-full overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-100/30 dark:border-slate-600 dark:bg-slate-800/20" />
      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center rounded-l-lg bg-slate-200/70 dark:bg-slate-700/50">
        <span
          className="whitespace-nowrap text-xs font-medium text-muted-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          {data.label || t("inspector.laneLabel")}
        </span>
      </div>
    </div>
  );
}

export const LaneNode = memo(LaneNodeComponent);
