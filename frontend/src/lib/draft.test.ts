import { afterEach, describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { clearDraft, loadDraft, recoverableDraft, saveDraft } from "./draft";

function node(id: string): Node {
  return { id, type: "shape", position: { x: 0, y: 0 }, data: {} };
}
function edge(id: string): Edge {
  return { id, source: "a", target: "b" };
}

afterEach(() => clearDraft());

describe("draft", () => {
  it("saves and loads a draft", () => {
    saveDraft({ id: null, name: "my draft", description: "", nodes: [], edges: [], saved: false, updatedAt: 1 });
    expect(loadDraft()?.name).toBe("my draft");
  });

  it("ignores a draft that was already saved", () => {
    saveDraft({ id: null, name: "n", description: "", nodes: [node("a")], edges: [], saved: true, updatedAt: 1 });
    expect(recoverableDraft()).toBeNull();
  });

  it("ignores an empty unsaved draft", () => {
    saveDraft({ id: null, name: "n", description: "", nodes: [], edges: [], saved: false, updatedAt: 1 });
    expect(recoverableDraft()).toBeNull();
  });

  it("recovers an unsaved draft with content", () => {
    saveDraft({
      id: "diag-1",
      name: "work",
      description: "d",
      nodes: [node("a")],
      edges: [edge("e")],
      saved: false,
      updatedAt: 1,
    });
    const d = recoverableDraft();
    expect(d?.id).toBe("diag-1");
    expect(d?.nodes).toHaveLength(1);
    expect(d?.edges).toHaveLength(1);
  });

  it("clears the draft", () => {
    saveDraft({ id: null, name: "n", description: "", nodes: [node("a")], edges: [], saved: false, updatedAt: 1 });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
