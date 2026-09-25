import type { ShapeType } from "@/lib/types";

interface ShapeProps {
  shape: ShapeType;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius?: number;
}

/**
 * Renders a shape path fitted into a width x height box.
 * All coordinates are absolute (not viewBox-scaled) so stroke widths stay
 * true at the node's pixel size.
 */
export function Shape({ shape, width, height, fill, stroke, strokeWidth, radius = 8 }: ShapeProps) {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const r = Math.min(radius, w / 2, h / 2);
  const sw = strokeWidth;

  const common = {
    fill: fill === "transparent" ? "none" : fill,
    stroke: stroke === "transparent" ? "none" : stroke,
    strokeWidth: sw,
    strokeLinejoin: "round" as const,
  };

  switch (shape) {
    case "rect":
      return (
        <rect
          x={sw / 2}
          y={sw / 2}
          width={w - sw}
          height={h - sw}
          rx={Math.max(r - sw / 2, 0)}
          ry={Math.max(r - sw / 2, 0)}
          {...common}
        />
      );

    case "rounded":
      return (
        <rect
          x={sw / 2}
          y={sw / 2}
          width={w - sw}
          height={h - sw}
          rx={Math.max(h / 2 - sw / 2, 1)}
          ry={Math.max(h / 2 - sw / 2, 1)}
          {...common}
        />
      );

    case "ellipse":
      return (
        <ellipse cx={w / 2} cy={h / 2} rx={Math.max(w / 2 - sw / 2, 1)} ry={Math.max(h / 2 - sw / 2, 1)} {...common} />
      );

    case "diamond":
      return (
        <polygon
          points={`${w / 2},${sw / 2} ${w - sw / 2},${h / 2} ${w / 2},${h - sw / 2} ${sw / 2},${h / 2}`}
          {...common}
        />
      );

    case "hexagon": {
      const p = 0.22;
      const points = `${w * p},${sw / 2} ${w * (1 - p)},${sw / 2} ${w - sw / 2},${h / 2} ${w * (1 - p)},${h - sw / 2} ${
        w * p
      },${h - sw / 2} ${sw / 2},${h / 2}`;
      return <polygon points={points} {...common} />;
    }

    case "triangle":
      return <polygon points={`${w / 2},${sw / 2} ${w - sw / 2},${h - sw / 2} ${sw / 2},${h - sw / 2}`} {...common} />;

    case "parallelogram": {
      const skew = w * 0.2;
      const points = `${skew},${sw / 2} ${w - sw / 2},${sw / 2} ${w - skew},${h - sw / 2} ${sw / 2},${h - sw / 2}`;
      return <polygon points={points} {...common} />;
    }

    case "cylinder": {
      const cy = h * 0.22;
      const rx = Math.max(w / 2 - sw / 2, 1);
      const d = [
        `M ${sw / 2},${cy}`,
        `A ${rx},${h * 0.18} 0 0 0 ${w - sw / 2},${cy}`,
        `L ${w - sw / 2},${h - cy}`,
        `A ${rx},${h * 0.18} 0 0 0 ${sw / 2},${h - cy}`,
        "Z",
      ].join(" ");
      return (
        <g>
          <path d={d} {...common} />
          <ellipse cx={w / 2} cy={cy} rx={rx} ry={Math.max(h * 0.18 - sw / 2, 1)} {...common} />
        </g>
      );
    }

    case "document": {
      const fold = Math.min(w * 0.22, 40);
      const d = [
        `M ${sw / 2},${sw / 2}`,
        `L ${w - fold - sw / 2},${sw / 2}`,
        `L ${w - sw / 2},${fold + sw / 2}`,
        `L ${w - sw / 2},${h - sw / 2}`,
        `L ${sw / 2},${h - sw / 2}`,
        "Z",
      ].join(" ");
      return (
        <g>
          <path d={d} {...common} />
          <path
            d={`M ${w - fold - sw / 2},${sw / 2} L ${w - fold - sw / 2},${fold + sw / 2} L ${w - sw / 2},${fold + sw / 2}`}
            fill="none"
            stroke={stroke === "transparent" ? "none" : stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </g>
      );
    }

    case "star": {
      const cx = w / 2;
      const cy = h / 2;
      const outer = Math.min(w, h) / 2 - sw / 2;
      const inner = outer * 0.45;
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? outer : inner;
        pts.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`);
      }
      return <polygon points={pts.join(" ")} {...common} />;
    }

    case "cloud": {
      const d = [
        `M ${w * 0.25},${h * 0.65}`,
        `A ${w * 0.15},${h * 0.2} 0 0 1 ${w * 0.25},${h * 0.35}`,
        `A ${w * 0.12},${h * 0.18} 0 0 1 ${w * 0.42},${h * 0.18}`,
        `A ${w * 0.18},${h * 0.22} 0 0 1 ${w * 0.72},${h * 0.22}`,
        `A ${w * 0.16},${h * 0.2} 0 0 1 ${w * 0.88},${h * 0.5}`,
        `A ${w * 0.12},${h * 0.16} 0 0 1 ${w * 0.75},${h * 0.7}`,
        "Z",
      ].join(" ");
      return <path d={d} {...common} />;
    }

    case "text":
      return null;

    default:
      return (
        <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={Math.max(r - sw / 2, 0)} {...common} />
      );
  }
}
