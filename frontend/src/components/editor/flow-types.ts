import { ShapeNode } from "./ShapeNode";
import { GroupNode } from "./GroupNode";
import { LifelineNode } from "./LifelineNode";
import { CustomEdge } from "./CustomEdge";

// Shared node/edge type maps used by both the editor and the read-only viewer.
export const nodeTypes = { shape: ShapeNode, group: GroupNode, lifeline: LifelineNode };
export const edgeTypes = { custom: CustomEdge };
