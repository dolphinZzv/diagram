import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Command } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEditor } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { SHAPE_LIST } from "@/lib/types";
import { TEMPLATES } from "@/lib/templates";
import { DIAGRAM_PALETTES } from "@/lib/palettes";
import { STYLE_PRESETS, presetStyle } from "@/lib/stylePresets";
import { exportPNG, exportSVG, exportJSON, exportMermaid, copyImageToClipboard } from "@/lib/exporter";
import { toMermaid } from "@/lib/mermaid";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Item {
  group: string;
  label: string;
  run: () => void;
}

function viewportCenter(screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number }) {
  const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
  const rect = pane?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  return screenToFlowPosition({ x, y });
}

export function CommandPalette() {
  const t = useT();
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const toggleSketch = useUi((s) => s.toggleSketch);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const { screenToFlowPosition, fitView, zoomTo, setCenter } = useReactFlow();

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const s = useEditor.getState();
    const add = (group: string, label: string, run: () => void): Item => ({ group, label, run });

    const actions: Item[] = [
      add(t("command.actions"), t("topbar.undo"), () => s.undo()),
      add(t("command.actions"), t("topbar.redo"), () => s.redo()),
      add(t("command.actions"), t("topbar.save"), () => window.dispatchEvent(new CustomEvent("diagram:save"))),
      add(t("command.actions"), t("ctx.selectAll"), () => s.selectAll()),
      add(t("command.actions"), t("ctx.copy"), () => s.copySelected()),
      add(t("command.actions"), t("ctx.paste"), () => s.paste()),
      add(t("command.actions"), t("ctx.duplicate"), () => s.duplicateSelected()),
      add(t("command.actions"), t("command.copyStyle"), () => s.copyStyle()),
      add(t("command.actions"), t("command.pasteStyle"), () => s.pasteStyle()),
      add(t("command.actions"), t("ctx.group"), () => s.groupSelected()),
      add(t("command.actions"), t("ctx.ungroup"), () => s.ungroupSelected()),
      add(t("command.actions"), t("ctx.lock"), () => s.lockSelected(true)),
      add(t("command.actions"), t("ctx.unlock"), () => s.lockSelected(false)),
      add(t("command.actions"), t("ctx.front"), () => s.bringToFront()),
      add(t("command.actions"), t("ctx.back"), () => s.sendToBack()),
      add(t("command.actions"), t("command.autoLayoutTB"), () => s.autoLayout("TB")),
      add(t("command.actions"), t("command.autoLayoutLR"), () => s.autoLayout("LR")),
      add(t("command.actions"), t("command.mindMap"), () => s.mindMapLayout()),
      add(t("command.actions"), t("command.laneGroup"), () => s.groupSelected("lane")),
      add(t("command.actions"), t("command.addLane"), () => s.addLane()),
      add(t("command.actions"), t("command.beautify"), () => s.beautify("ocean")),
      add(t("command.actions"), t("command.sketch"), () => toggleSketch()),
      add(t("command.actions"), t("seq.addParticipant"), () => s.addParticipant()),
      add(t("command.actions"), t("command.addNote"), () => {
        const c = viewportCenter(screenToFlowPosition);
        s.addShapeNode("note", { x: c.x - 75, y: c.y - 55 });
      }),
      add(t("command.actions"), t("ctx.fitView"), () => fitView({ padding: 0.25 })),
      add(t("command.actions"), t("ctx.zoomReset"), () => zoomTo(1)),
      add(t("command.templates"), t("topbar.browseTemplates"), () => useUi.getState().setTemplateGalleryOpen(true)),
      add(t("command.actions"), t("import.title"), () => useUi.getState().setImportOpen(true)),
      add(t("command.actions"), t("present.start"), () => {
        const order = s.nodes.filter((n) => n.type !== "group").map((n) => n.id);
        if (order.length) useUi.getState().startPresentation(order);
      }),
      add(t("command.actions"), t("topbar.exportPng"), () => {
        void exportPNG(s.nodes, s.edges, s.meta.name || "diagram", theme);
      }),
      add(t("command.actions"), t("topbar.exportSvg"), () => exportSVG(s.nodes, s.edges, s.meta.name || "diagram", theme)),
      add(t("command.actions"), t("topbar.exportJson"), () => exportJSON({ nodes: s.nodes, edges: s.edges }, s.meta.name || "diagram")),
      add(t("command.actions"), t("command.exportMermaid"), () =>
        exportMermaid(toMermaid(s.nodes, s.edges), s.meta.name || "diagram")
      ),
      add(t("command.actions"), t("command.copyMermaid"), async () => {
        (await copyText(toMermaid(s.nodes, s.edges))) && toast.success(t("share.linkCopied"));
      }),
      add(t("command.actions"), t("command.copyImage"), async () => {
        const r = await copyImageToClipboard(s.nodes, s.edges, theme);
        toast.success(r === "copied" ? t("command.imageCopied") : t("topbar.exportedImage", { format: "PNG" }));
      }),
      add(t("command.actions"), t("command.theme"), () => setTheme(theme === "dark" ? "light" : "dark")),
      add(t("command.actions"), t("command.language"), () => setLang(lang === "zh" ? "en" : "zh")),
      add(t("command.actions"), t("shortcuts.menu"), () => useUi.getState().setShortcutsOpen(true)),
    ];

    const palettes: Item[] = Object.entries(DIAGRAM_PALETTES).map(([key, p]) =>
      add(t("command.palette"), `${t("command.palette")}: ${t(p.nameKey)}`, () => s.restyleAll(key))
    );

    const presets: Item[] = STYLE_PRESETS.map((p) =>
      add(t("command.presets"), t(p.nameKey), () => s.applyStyle(presetStyle(p)))
    );

    const shapes: Item[] = SHAPE_LIST.map((shape) =>
      add(
        t("command.shapes"),
        t(`shape.${shape}`),
        () => {
          const c = viewportCenter(screenToFlowPosition);
          s.addShapeNode(shape, { x: c.x - 60, y: c.y - 30 });
        }
      )
    );

    const templates: Item[] = TEMPLATES.map((tpl) =>
      add(t("command.templates"), t(`template.${tpl.id}.name`), () => {
        const { nodes, edges } = tpl.build();
        s.loadDoc(nodes, edges);
        s.setMeta({ id: null, name: t(`template.${tpl.id}.name`), description: t(`template.${tpl.id}.desc`), saved: false });
        setTimeout(() => fitView({ padding: 0.25 }), 40);
      })
    );

    const nodes: Item[] = s.nodes
      .filter((n) => n.type !== "group")
      .map((n) => {
        const label = ((n.data as { label?: string }).label || n.id) as string;
        return add(t("command.nodes"), label, () => {
          s.setSelection([n.id]);
          const w = (n.style?.width as number) || (n.data as { width?: number }).width || 120;
          const h = (n.style?.height as number) || (n.data as { height?: number }).height || 60;
          setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: 1.2, duration: 400 });
        });
      });

    return [...actions, ...palettes, ...presets, ...shapes, ...templates, ...nodes];
  }, [t, screenToFlowPosition, fitView, zoomTo, setCenter, theme, setTheme, lang, setLang, toggleSketch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 60);
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)).slice(0, 60);
  }, [items, query]);

  useEffect(() => {
    setIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const runItem = useCallback(
    (item: Item) => {
      setOpen(false);
      item.run();
    },
    [setOpen]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[index];
      if (item) runItem(item);
    }
  };

  // Keep the active row visible.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  let lastGroup = "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] max-w-lg translate-y-0 gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("command.title")}</DialogTitle>
          <DialogDescription>{t("command.placeholder")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-3">
          <Command className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("command.placeholder")}
            className="h-11 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("command.empty")}</div>
          ) : (
            filtered.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : "";
              lastGroup = item.group;
              return (
                <div key={`${item.group}-${item.label}-${i}`}>
                  {header ? (
                    <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {header}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => runItem(item)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      i === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                    )}
                  >
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
