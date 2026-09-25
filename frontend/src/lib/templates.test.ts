import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./templates";
import type { ShapeNodeData } from "./types";

describe("TEMPLATES", () => {
  it("exposes at least three templates with unique ids", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const tpl of TEMPLATES) {
    describe(tpl.name, () => {
      it("builds a non-empty, well-formed diagram", () => {
        const { nodes, edges } = tpl.build();
        expect(nodes.length).toBeGreaterThan(0);
        expect(edges.length).toBeGreaterThan(0);

        const nodeIds = new Set(nodes.map((n) => n.id));
        expect(nodeIds.size).toBe(nodes.length);

        for (const n of nodes) {
          expect(["shape", "lifeline"]).toContain(n.type);
          const data = n.data as ShapeNodeData;
          expect(data.shape).toBeTruthy();
          expect(data.width).toBeGreaterThan(0);
          expect(data.height).toBeGreaterThan(0);
        }

        for (const e of edges) {
          expect(nodeIds.has(e.source), `edge ${e.id} source`).toBe(true);
          expect(nodeIds.has(e.target), `edge ${e.id} target`).toBe(true);
          expect(e.type).toBe("custom");
        }
      });

      it("can be rebuilt independently", () => {
        const a = tpl.build();
        const b = tpl.build();
        expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
        // Must not share node objects between builds.
        expect(a.nodes[0]).not.toBe(b.nodes[0]);
      });
    });
  }
});
