import { beforeEach, describe, expect, it } from "vitest";
import { callAgentTool } from "./agentTools";
import { useEditor } from "./store";

function reset() {
  useEditor.setState({
    nodes: [],
    edges: [],
    selected: null,
    selectedIds: [],
    past: [],
    future: [],
    meta: { id: null, name: "t", description: "", saved: true, saving: false, shareToken: "" },
  });
}
beforeEach(reset);

describe("agent tools", () => {
  it("adds nodes and an edge, then reports state", async () => {
    const a = (await callAgentTool("diagram_add_node", { shape: "rounded", label: "A", x: 0, y: 0 })) as {
      nodeId: string;
    };
    const b = (await callAgentTool("diagram_add_node", { shape: "rect", label: "B", x: 220, y: 0 })) as {
      nodeId: string;
    };
    const e = (await callAgentTool("diagram_add_edge", {
      source: a.nodeId,
      target: b.nodeId,
      sourceHandle: "r",
      targetHandle: "l",
      label: "go",
    })) as { edgeId: string };
    expect(e.edgeId).toBeTruthy();

    const state = (await callAgentTool("diagram_get_state")) as { nodes: unknown[]; edges: unknown[] };
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(1);

    const mm = (await callAgentTool("diagram_export_mermaid")) as { mermaid: string };
    expect(mm.mermaid).toContain("-->");
  });

  it("updates and removes nodes", async () => {
    const a = (await callAgentTool("diagram_add_node", { x: 0, y: 0 })) as { nodeId: string };
    await callAgentTool("diagram_update_node", { nodeId: a.nodeId, patch: { label: "renamed" } });
    expect((useEditor.getState().nodes[0].data as { label: string }).label).toBe("renamed");
    await callAgentTool("diagram_remove_nodes", { nodeIds: [a.nodeId] });
    expect(useEditor.getState().nodes).toHaveLength(0);
  });

  it("undo reverts an agent change", async () => {
    await callAgentTool("diagram_add_node", { x: 0, y: 0 });
    await callAgentTool("diagram_undo");
    expect(useEditor.getState().nodes).toHaveLength(0);
  });

  it("rejects unknown tools", async () => {
    await expect(callAgentTool("does_not_exist")).rejects.toThrow();
  });
});
