import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import App from "@/App";
import { useEditor } from "@/lib/store";

afterEach(() => {
  cleanup();
  useEditor.getState().loadDoc([], []);
});

// Regression: SelectionToolbar used to call useIsCompactLayout() *after* an
// early return, which changed the hook count once a node became selected and
// crashed the whole app ("Rendered more hooks than during the previous render").
describe("SelectionToolbar selection lifecycle", () => {
  it("survives a node becoming selected and then moved", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))
    );

    render(<App />);

    act(() => useEditor.getState().addShapeNode("rect", { x: 0, y: 0 }));
    const id = useEditor.getState().nodes[0].id;

    // No selection -> the toolbar returns null.
    act(() => useEditor.getState().setSelection([id]));

    // Moving a selected node re-renders the toolbar.
    act(() => {
      useEditor.getState().onNodesChange([{ type: "position", id, position: { x: 10, y: 10 }, dragging: true }]);
      useEditor.getState().onNodesChange([{ type: "position", id, position: { x: 20, y: 20 }, dragging: false }]);
    });

    expect(useEditor.getState().nodes[0].position).toEqual({ x: 20, y: 20 });
  });
});
