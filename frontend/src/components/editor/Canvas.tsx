import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type Node,
  type NodeChange,
  type EdgeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, edgeTypes } from "./flow-types";
import { useEditor } from "@/lib/store";
import { ARCH_PRESETS, PRESET_SHAPES } from "./ShapePalette";
import { defaultNodeData, type ShapeType } from "@/lib/types";
import { uid } from "@/lib/id";

export function Canvas() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const setSelection = useEditor((s) => s.setSelection);
  const addNode = useEditor((s) => s.addNode);
  const addShapeNode = useEditor((s) => s.addShapeNode);

  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

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
        addShapeNode(value as ShapeType, { x: position.x - 80, y: position.y - 40 });
        return;
      }
      if (kind === "preset") {
        const preset = ARCH_PRESETS.find((p) => p.key === value);
        if (!preset) return;
        const shape = PRESET_SHAPES[value] ?? "rounded";
        const data = {
          ...defaultNodeData(shape),
          label: preset.label,
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
      }
    },
    [addNode, addShapeNode, screenToFlowPosition]
  );

  const onSelectionChange = useCallback(
    ({ nodes: sn, edges: se }: OnSelectionChangeParams) => {
      setSelection([...sn.map((n) => n.id), ...se.map((e) => e.id)]);
    },
    [setSelection]
  );

  return (
    <div ref={wrapperRef} className="h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as (c: NodeChange<Node>[]) => void}
        onEdgesChange={onEdgesChange as (c: EdgeChange[]) => void}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        snapToGrid
        snapGrid={[10, 10]}
        deleteKeyCode={null}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{ type: "custom" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#cbd5e1" />
        <Controls className="!rounded-md !border !bg-background !shadow" showInteractive={false} />
        <MiniMap
          className="!rounded-md !border"
          pannable
          zoomable
          nodeStrokeWidth={3}
          nodeColor={(n) => (n.data?.fill as string) || "#e2e8f0"}
        />
      </ReactFlow>
    </div>
  );
}
