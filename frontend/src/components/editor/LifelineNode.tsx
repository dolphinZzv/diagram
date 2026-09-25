import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { SEQ_HEADER, SEQ_ROWS, SEQ_ROW_GAP, SEQ_WIDTH, rowHandleId, rowOffset } from "@/lib/sequence";

export interface LifelineData extends Record<string, unknown> {
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
  width: number;
  height: number;
}

type LifelineNodeType = Node<LifelineData, "lifeline">;

const handleStyle = { opacity: 0, width: 8, height: 8 } as const;

function LifelineNodeComponent({ data }: NodeProps<LifelineNodeType>) {
  const w = data.width || SEQ_WIDTH;
  const h = data.height || SEQ_HEADER + SEQ_ROWS * SEQ_ROW_GAP;

  return (
    <div className="lifeline-node relative h-full w-full">
      {/* participant header */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center rounded-md border-2 px-2 text-center text-sm font-medium"
        style={{ height: SEQ_HEADER, background: data.fill, borderColor: data.stroke, color: data.textColor }}
      >
        <span className="truncate">{data.label}</span>
      </div>

      {/* dashed lifeline */}
      <div
        className="absolute w-0 border-l-2 border-dashed"
        style={{ left: w / 2, top: SEQ_HEADER, height: h - SEQ_HEADER, borderColor: data.stroke, opacity: 0.55 }}
      />

      {/* message handles: one pair per row */}
      {Array.from({ length: SEQ_ROWS }).map((_, row) => (
        <span key={row}>
          <Handle
            type="source"
            position={Position.Left}
            id={rowHandleId("l", row)}
            style={{ ...handleStyle, top: rowOffset(row) }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id={rowHandleId("r", row)}
            style={{ ...handleStyle, top: rowOffset(row) }}
          />
        </span>
      ))}
    </div>
  );
}

export const LifelineNode = memo(LifelineNodeComponent);

export { SEQ_ROW_GAP };
