import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position, NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { Boxes, Loader2 } from "lucide-react";
import type { SubgraphNodeData } from "@/lib/types";
import { useEditor } from "@/lib/store";
import { api } from "@/lib/api";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { diagramToSvg } from "@/lib/svgExport";
import { useT } from "@/lib/i18n";

type SubgraphNodeType = Node<SubgraphNodeData, "subgraph">;

interface Preview {
  src: string;
  nodes: number;
  edges: number;
}

// Child diagram previews, cached briefly to avoid refetching while panning.
const cache = new Map<string, { at: number; preview: Preview | null }>();
const CACHE_MS = 30_000;
// Cap the rasterised preview size so a huge child diagram can't blow up memory.
const MAX_PREVIEW = 2000;

function useSubgraphPreview(diagramId: string): { preview: Preview | null; loading: boolean } {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!diagramId) {
      setPreview(null);
      return;
    }
    const hit = cache.get(diagramId);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setPreview(hit.preview);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .get(diagramId)
      .then((rec) => {
        const nodes = normalizeNodes(rec.data.nodes ?? []);
        const edges = normalizeEdges(rec.data.edges ?? []);
        let next: Preview | null = null;
        if (nodes.length || edges.length) {
          // Render as an <img> data-URL: SVG loaded via <img> never executes
          // scripts, so a hostile child diagram cannot inject code here.
          const svg = diagramToSvg(nodes, edges, { theme: "light", padding: 16 });
          next = {
            src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
            nodes: nodes.length,
            edges: edges.length,
          };
        } else {
          next = { src: "", nodes: 0, edges: 0 };
        }
        cache.set(diagramId, { at: Date.now(), preview: next });
        if (alive) setPreview(next);
      })
      .catch(() => {
        if (alive) setPreview(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [diagramId]);

  return { preview, loading };
}

function SubgraphNodeComponent({ id, data, selected }: NodeProps<SubgraphNodeType>) {
  const t = useT();
  const updateNodeData = useEditor((s) => s.updateNodeData);
  const { preview, loading } = useSubgraphPreview(data.diagramId);

  // Stable callback: React Flow rebuilds the resizer whenever this changes,
  // which would break continuous touch resizing.
  const onResizeEnd = useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      updateNodeData(id, { width: Math.round(params.width), height: Math.round(params.height) });
    },
    [id, updateNodeData]
  );

  return (
    <div className="subgraph-node relative h-full w-full" onContextMenu={(e) => e.preventDefault()}>
      <NodeResizer
        minWidth={120}
        minHeight={90}
        maxWidth={MAX_PREVIEW}
        maxHeight={MAX_PREVIEW}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!border-primary !bg-background"
        onResizeEnd={onResizeEnd}
      />

      <div
        className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-lg border-2 border-dashed"
        style={{
          borderColor: data.stroke || "#94a3b8",
          background: data.fill || "#f8fafc",
          opacity: data.opacity ?? 1,
        }}
      >
        <div
          className="flex shrink-0 items-center gap-1 border-b px-2 py-1 text-[11px] font-semibold"
          style={{ color: data.textColor || "#0f172a", borderColor: data.stroke || "#94a3b8" }}
        >
          <Boxes className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{data.label || t("subgraph.untitled")}</span>
          <span className="ml-auto shrink-0 rounded bg-black/5 px-1 py-px text-[9px] font-medium uppercase tracking-wide">
            {t("subgraph.badge")}
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {preview?.src ? (
            <img
              src={preview.src}
              alt=""
              draggable={false}
              className="h-full w-full object-contain p-1"
            />
          ) : loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-muted-foreground">
              <Boxes className="h-5 w-5 opacity-40" />
              <span>{data.diagramId ? t("subgraph.noPreview") : t("subgraph.noTarget")}</span>
            </div>
          )}
          <div className="pointer-events-none absolute right-1 top-1 rounded bg-background/85 px-1 text-[9px] text-muted-foreground">
            {t("subgraph.hint")}
          </div>
        </div>
        {preview && (preview.nodes > 0 || preview.edges > 0) ? (
          <div className="shrink-0 border-t px-2 py-0.5 text-[9px] text-muted-foreground">
            {t("subgraph.counts", { nodes: preview.nodes, edges: preview.edges })}
          </div>
        ) : null}
      </div>

      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
    </div>
  );
}

export const SubgraphNode = memo(SubgraphNodeComponent);
