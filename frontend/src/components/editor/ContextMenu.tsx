import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CtxItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

interface Props {
  x: number;
  y: number;
  items: (CtxItem | "separator")[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof globalThis.Node && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("wheel", onClose, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  // Keep the menu inside the viewport once its size is known.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - 8;
    const maxY = window.innerHeight - 8;
    if (x + rect.width > maxX) el.style.left = `${Math.max(8, maxX - rect.width)}px`;
    if (y + rect.height > maxY) el.style.top = `${Math.max(8, maxY - rect.height)}px`;
  }, [x, y]);

  const style: CSSProperties = { left: x, top: y };

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[190px] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === "separator" ? (
          <div key={`sep-${i}`} className="my-1 h-px bg-muted" />
        ) : (
          <button
            key={it.label + i}
            type="button"
            disabled={it.disabled}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
              it.danger && "text-destructive"
            )}
          >
            {it.icon ? <span className="flex h-4 w-4 items-center justify-center">{it.icon}</span> : null}
            <span className="flex-1">{it.label}</span>
            {it.shortcut ? (
              <span className="font-mono text-[10px] text-muted-foreground">{it.shortcut}</span>
            ) : null}
          </button>
        )
      )}
    </div>
  );
}
