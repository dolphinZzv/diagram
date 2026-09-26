import { useCallback } from "react";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useDiagramActions } from "@/hooks/useDiagramActions";
import { toast } from "@/lib/toast";
import { tr } from "@/lib/i18n";

/**
 * Navigation between nested documents (subgraph nodes). Entering a referenced
 * diagram pushes the current one onto a breadcrumb stack; going back pops it.
 * Re-entering a diagram already in the stack is blocked (cycle guard).
 */
export function useSubgraphNav() {
  const { openDiagram } = useDiagramActions();

  const enter = useCallback(
    async (diagramId: string, label?: string) => {
      if (!diagramId) return;
      const cur = useEditor.getState().meta;
      const path = useUi.getState().subgraphPath;
      if (diagramId === cur.id || path.some((p) => p.id === diagramId)) {
        toast.error(tr("subgraph.cycle"));
        return;
      }
      const parent = { id: cur.id, name: cur.name };
      const ok = await openDiagram(diagramId);
      if (ok && parent.id) {
        useUi.getState().pushSubgraph({ id: parent.id, name: label || parent.name });
      }
    },
    [openDiagram]
  );

  const back = useCallback(
    async (toIndex: number) => {
      const path = useUi.getState().subgraphPath;
      const target = path[toIndex];
      if (!target) return;
      if (await openDiagram(target.id)) {
        useUi.getState().setSubgraphPath(path.slice(0, toIndex));
      }
    },
    [openDiagram]
  );

  return { enter, back };
}
