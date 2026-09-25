import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  "#0f172a",
  "#475569",
  "#94a3b8",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ffffff",
  "transparent",
];

interface ColorFieldProps {
  value: string;
  onChange: (v: string) => void;
  allowTransparent?: boolean;
}

export function ColorField({ value, onChange, allowTransparent = true }: ColorFieldProps) {
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-input">
          <span
            className="absolute inset-0"
            style={{
              background:
                value === "transparent"
                  ? "repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 50% / 12px 12px"
                  : value,
            }}
          />
          <input
            type="color"
            value={isHex ? value : "#475569"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => allowTransparent || p !== "transparent").map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className={cn(
              "h-5 w-5 rounded border border-input transition-transform hover:scale-110",
              value === c && "ring-2 ring-primary ring-offset-1"
            )}
            style={{
              background:
                c === "transparent"
                  ? "repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 50% / 8px 8px"
                  : c,
            }}
          />
        ))}
      </div>
    </div>
  );
}
