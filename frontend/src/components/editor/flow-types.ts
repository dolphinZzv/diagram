import { ShapeNode } from "./ShapeNode";
import { GroupNode } from "./GroupNode";
import { LaneNode } from "./LaneNode";
import { LifelineNode } from "./LifelineNode";
import { CustomEdge } from "./CustomEdge";

// Shared node/edge type maps used by both the editor and the read-only viewer.
export const nodeTypes = {
  shape: ShapeNode,
  group: GroupNode,
  lane: LaneNode,
  lifeline: LifelineNode,
};
export const edgeTypes = { custom: CustomEdge };
