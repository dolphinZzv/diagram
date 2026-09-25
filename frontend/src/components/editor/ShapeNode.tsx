import { memo, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { Lock } from "lucide-react";
import { Shape } from "./Shape";
import type { ShapeNodeData } from "@/lib/types";
import { useEditor } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";

type ShapeNodeType = Node<ShapeNodeData, "shape">;

function ShapeNodeComponent({ id, data, selected, width, height }: NodeProps<ShapeNodeType>) {
  const updateNodeData = useEditor((s) => s.updateNodeData);
  const t = useT();
  const w = Math.round(width || data.width || 160);
  const h = Math.round(height || data.height || 80);
  const locked = !!data.locked;

  // Long-press (touch or mouse) duplicates the shape.
  const pressTimer = useRef<number | undefined>(undefined);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const cancelPress = () => {
    if (pressTimer.current !== undefined) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = undefined;
    }
    pressOrigin.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = undefined;
      pressOrigin.current = null;
      const store = useEditor.getState();
      store.setSelection([id]);
      store.duplicateSelected();
      toast.success(t("editor.copied"));
    }, 550);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const origin = pressOrigin.current;
    if (!origin) return;
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 8) cancelPress();
  };

  return (
    <div
      className="shape-node relative h-full w-full"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <NodeResizer
        minWidth={30}
        minHeight={24}
        isVisible={selected && !locked}
        lineClassName="!border-primary"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-primary !bg-background"
        onResizeEnd={(_e, params) => {
          updateNodeData(id, { width: Math.round(params.width), height: Math.round(params.height) });
        }}
      />

      <div
        className="h-full w-full"
        style={{ transform: `rotate(${data.rotation || 0}deg)`, transformOrigin: "center center" }}
      >
        <svg width={w} height={h} className="block overflow-visible" style={{ opacity: data.opacity ?? 1 }}>
          <Shape
            shape={data.shape}
            width={w}
            height={h}
            fill={data.fill}
            stroke={data.stroke}
            strokeWidth={data.strokeWidth}
            radius={data.radius}
          />
        </svg>
        {data.label ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-pre-wrap break-words px-3 text-center leading-tight"
            style={{
              color: data.textColor,
              fontSize: data.fontSize,
              fontWeight: data.fontWeight as never,
              fontStyle: data.fontStyle as never,
            }}
          >
            {data.label}
          </div>
        ) : null}
      </div>

      {!locked && (
        <>
          <Handle type="source" position={Position.Top} id="t" />
          <Handle type="source" position={Position.Right} id="r" />
          <Handle type="source" position={Position.Bottom} id="b" />
          <Handle type="source" position={Position.Left} id="l" />
        </>
      )}

      {locked && (
        <div className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-amber-500 p-0.5 text-white shadow">
          <Lock className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
