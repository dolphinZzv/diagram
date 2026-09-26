import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import App from "@/App";
import { useEditor } from "@/lib/store";

afterEach(() => {
  cleanup();
  useEditor.getState().loadDoc([], []);
});

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))
  );
}

// Exercises every selection kind the Inspector / SelectionToolbar / actions bar
// can render. A Rules-of-Hooks violation in any of them throws here.
describe("selection lifecycle", () => {
  it("node selection", () => {
    stubFetch();
    render(<App />);
    act(() => useEditor.getState().addShapeNode("rect", { x: 0, y: 0 }));
    const id = useEditor.getState().nodes[0].id;
    act(() => useEditor.getState().setSelection([id]));
    expect(useEditor.getState().selectedIds).toEqual([id]);
  });

  it("edge selection", () => {
    stubFetch();
    render(<App />);
    act(() => {
      useEditor.getState().addShapeNode("rect", { x: 0, y: 0 });
      useEditor.getState().addShapeNode("rect", { x: 300, y: 0 });
    });
    const [a, b] = useEditor.getState().nodes.map((n) => n.id);
    act(() => useEditor.getState().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null }));
    const edgeId = useEditor.getState().edges[0].id;
    act(() => useEditor.getState().setSelection([edgeId]));
    expect(useEditor.getState().selectedIds).toEqual([edgeId]);
  });

  it("multi selection + group + lock", () => {
    stubFetch();
    render(<App />);
    act(() => {
      useEditor.getState().addShapeNode("rect", { x: 0, y: 0 });
      useEditor.getState().addShapeNode("rect", { x: 300, y: 0 });
    });
    const ids = useEditor.getState().nodes.map((n) => n.id);
    act(() => useEditor.getState().setSelection(ids));
    act(() => useEditor.getState().groupSelected());
    act(() => useEditor.getState().lockSelected(true));
    expect(useEditor.getState().nodes.length).toBeGreaterThan(0);
  });
});
