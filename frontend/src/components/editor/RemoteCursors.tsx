import { ViewportPortal } from "@xyflow/react";
import { usePeers } from "@/lib/peers";

/**
 * Renders other collaborators' cursors in flow coordinates (inside the React
 * Flow viewport, so they pan/zoom with the canvas).
 */
export function RemoteCursors() {
  const peers = usePeers((s) => s.peers);
  const list = Object.values(peers).filter((p) => p.cursor);
  if (list.length === 0) return null;
  return (
    <ViewportPortal>
      {list.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none absolute z-[9999]"
          style={{ left: p.cursor!.x, top: p.cursor!.y }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: "translate(-3px,-3px)" }}>
            <path
              d="M5.5 3.2 L5.5 20.2 L10.2 15.4 L13.2 21 L15.3 19.1 L12.3 14.3 L18.5 14.1 Z"
              fill={p.color}
              stroke="#fff"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="ml-3 inline-block -translate-y-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow"
            style={{ background: p.color }}
          >
            {p.name}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}
