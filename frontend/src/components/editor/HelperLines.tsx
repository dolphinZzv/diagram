import { ViewportPortal } from "@xyflow/react";

interface Props {
  vertical?: number;
  horizontal?: number;
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Smart alignment guides rendered inside the React Flow viewport, so the
 * coordinates are in flow space.
 */
export function HelperLines({ vertical, horizontal, minX, minY, width, height }: Props) {
  const pad = 40;
  return (
    <ViewportPortal>
      {vertical !== undefined ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: vertical,
            top: minY - pad,
            width: 1,
            height: height + pad * 2,
            background: "#f59e0b",
          }}
        />
      ) : null}
      {horizontal !== undefined ? (
        <div
          className="pointer-events-none absolute"
          style={{
            top: horizontal,
            left: minX - pad,
            height: 1,
            width: width + pad * 2,
            background: "#f59e0b",
          }}
        />
      ) : null}
    </ViewportPortal>
  );
}
