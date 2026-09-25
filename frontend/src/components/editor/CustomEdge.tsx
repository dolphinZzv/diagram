import { memo, useCallback, useMemo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { dashArray, polyline, smoothPathThrough, type Pt } from "@/lib/geometry";
import type { EdgeData } from "@/lib/types";
import { useEditor } from "@/lib/store";

type EdgeType = Edge<EdgeData, "custom">;

function markerPath(arrowType: EdgeData["arrowType"]): { path: string; size: number } | null {
  switch (arrowType) {
    case "arrowclosed":
      return { path: "M0,0 L10,4 L0,8 z", size: 10 };
    case "arrow":
      return { path: "M0,0 L10,4 L0,8", size: 10 };
    case "diamond":
      return { path: "M0,4 L5,0 L10,4 L5,8 z", size: 10 };
    default:
      return null;
  }
}

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  animated,
}: EdgeProps<EdgeType>) {
  const { screenToFlowPosition } = useReactFlow();
  const updateEdgeData = useEditor((s) => s.updateEdgeData);
  const pushHistory = useEditor((s) => s.pushHistory);

  const color = data?.color ?? "#475569";
  const strokeWidth = data?.width ?? 2;
  const lineStyle = data?.lineStyle ?? "solid";
  const pathType = data?.pathType ?? "bezier";
  const arrowType = data?.arrowType ?? "arrowclosed";
  const label = data?.label ?? "";
  const labelRotation = data?.labelRotation ?? 0;
  const points = useMemo<Pt[]>(() => data?.points ?? [], [data?.points]);

  // Build the path.
  const { path, labelX, labelY, allPoints } = useMemo(() => {
    if (points.length > 0) {
      const chain: Pt[] = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }];
      const d = pathType === "straight" ? polyline(chain) : smoothPathThrough(chain);
      // label at path middle
      const midIdx = Math.floor(chain.length / 2);
      const a = chain[midIdx - 1] ?? chain[0];
      const b = chain[midIdx] ?? chain[chain.length - 1];
      return { path: d, labelX: (a.x + b.x) / 2, labelY: (a.y + b.y) / 2, allPoints: chain };
    }
    if (pathType === "straight") {
      const [d, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY });
      return { path: d, labelX: lx, labelY: ly, allPoints: [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }] };
    }
    if (pathType === "step" || pathType === "smoothstep") {
      const [d, lx, ly] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: pathType === "step" ? 0 : 8,
      });
      return { path: d, labelX: lx, labelY: ly, allPoints: [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }] };
    }
    const [d, lx, ly] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    return { path: d, labelX: lx, labelY: ly, allPoints: [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }] };
  }, [points, pathType, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const marker = markerPath(arrowType);
  const markerId = `marker-end-${id}-${arrowType}`;
  const startArrowType = data?.startArrowType ?? "none";
  const startMarker = markerPath(startArrowType);
  const startMarkerId = `marker-start-${id}-${startArrowType}`;

  const onWaypointDown = useCallback(
    (index: number, evt: React.PointerEvent) => {
      evt.stopPropagation();
      evt.preventDefault();
      const el = evt.currentTarget as SVGCircleElement;
      el.setPointerCapture(evt.pointerId);
      pushHistory();

      const move = (e: PointerEvent) => {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const next = points.map((p, i) => (i === index ? { x: pos.x, y: pos.y } : p));
        // update without pushing history every move
        const { edges } = useEditor.getState();
        useEditor.setState({
          edges: edges.map((ed) =>
            ed.id === id ? { ...ed, data: { ...ed.data, points: next } } : ed
          ),
          meta: { ...useEditor.getState().meta, saved: false },
        });
      };
      const up = (e: PointerEvent) => {
        el.releasePointerCapture(e.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [id, points, screenToFlowPosition, pushHistory]
  );

  const addWaypointAt = useCallback(
    (index: number) => {
      const a = allPoints[index];
      const b = allPoints[index + 1];
      if (!a || !b) return;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const next = [...points, mid];
      updateEdgeData(id, { points: next });
    },
    [allPoints, points, id, updateEdgeData]
  );

  const removeWaypoint = useCallback(
    (index: number) => {
      updateEdgeData(id, { points: points.filter((_, i) => i !== index) });
    },
    [id, points, updateEdgeData]
  );

  return (
    <>
      <defs>
        {marker && (
          <marker
            id={markerId}
            markerWidth={marker.size}
            markerHeight={marker.size}
            refX={marker.size - 1}
            refY={marker.size / 2}
            orient="auto-start-reverse"
            viewBox={`0 0 ${marker.size} ${marker.size}`}
            markerUnits="userSpaceOnUse"
          >
            <path d={marker.path} fill={arrowType === "arrow" ? "none" : color} stroke={color} strokeWidth={1.5} />
          </marker>
        )}
        {startMarker && (
          <marker
            id={startMarkerId}
            markerWidth={startMarker.size}
            markerHeight={startMarker.size}
            refX={1}
            refY={startMarker.size / 2}
            orient="auto-start-reverse"
            viewBox={`0 0 ${startMarker.size} ${startMarker.size}`}
            markerUnits="userSpaceOnUse"
          >
            <path
              d={startMarker.path}
              fill={startArrowType === "arrow" ? "none" : color}
              stroke={color}
              strokeWidth={1.5}
            />
          </marker>
        )}
      </defs>

      <BaseEdge
        id={id}
        path={path}
        markerStart={startMarker ? `url(#${startMarkerId})` : undefined}
        markerEnd={marker ? `url(#${markerId})` : undefined}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: dashArray(lineStyle),
          animation: animated ? "dashdraw 0.5s linear infinite" : undefined,
        }}
      />

      {/* interaction / add-point affordance */}
      {selected &&
        allPoints.slice(0, -1).map((_, i) => {
          const a = allPoints[i];
          const b = allPoints[i + 1];
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          return (
            <circle
              key={`add-${i}`}
              cx={mid.x}
              cy={mid.y}
              r={5}
              fill="#fff"
              stroke={color}
              strokeWidth={1.5}
              style={{ cursor: "copy" }}
              className="nodrag nopan"
              onPointerDown={(e) => {
                e.stopPropagation();
                addWaypointAt(i);
              }}
            />
          );
        })}

      {/* draggable waypoints */}
      {points.map((p, i) => (
        <circle
          key={`wp-${i}`}
          cx={p.x}
          cy={p.y}
          r={6}
          fill="#fff"
          stroke="#3b82f6"
          strokeWidth={2}
          style={{ cursor: "grab" }}
          className="nodrag nopan"
          onPointerDown={(e) => onWaypointDown(i, e)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            removeWaypoint(i);
          }}
        />
      ))}

      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-background/90 px-1.5 py-0.5 text-xs shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) rotate(${labelRotation}deg)`,
              color,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);
