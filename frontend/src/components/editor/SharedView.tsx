import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, Loader2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nodeTypes, edgeTypes } from "./flow-types";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { api, type SharedDiagram } from "@/lib/api";
import { exportImage } from "@/lib/exporter";

function Viewer({ doc }: { doc: SharedDiagram }) {
  const nodes = useMemo<Node[]>(() => normalizeNodes(doc.data.nodes ?? []), [doc]);
  const edges = useMemo<Edge[]>(() => normalizeEdges(doc.data.edges ?? []), [doc]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Workflow className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{doc.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            只读分享 · 更新于 {new Date(doc.updatedAt).toLocaleString()}
          </div>
        </div>
        <div className="ml-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportImage(nodes, "png", doc.name || "diagram").catch(() => undefined)}
          >
            <Download className="h-4 w-4" /> 导出 PNG
          </Button>
        </div>
      </header>

      <div className="readonly-canvas relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          nodesFocusable={false}
          zoomOnScroll
          zoomOnPinch
          panOnDrag
          minZoom={0.1}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#cbd5e1" />
          <Controls className="!rounded-md !border !bg-background !shadow" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function SharedView({ token }: { token: string }) {
  const [doc, setDoc] = useState<SharedDiagram | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getShared(token)
      .then((d) => {
        if (alive) {
          setDoc(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Workflow className="h-10 w-10 opacity-30" />
        <p className="text-sm">分享不存在或已关闭</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <Viewer doc={doc} />
    </ReactFlowProvider>
  );
}
