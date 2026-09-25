import { LayoutGrid, Keyboard, Sparkles, Bot, Copy, BookOpen } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui";
import { toast } from "@/lib/toast";
import { copyText } from "@/lib/clipboard";

/** First-run guidance shown while the canvas is empty. */
export function EmptyState() {
  const t = useT();
  const loadDoc = useEditor((s) => s.loadDoc);
  const setMeta = useEditor((s) => s.setMeta);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const { fitView } = useReactFlow();

  const mcpConfig = JSON.stringify(
    { mcpServers: { diagram: { command: "diagram", args: ["mcp"] } } },
    null,
    2
  );

  const copyMcp = async () => {
    const ok = await copyText(mcpConfig);
    if (ok) toast.success(t("empty.mcpCopied"));
    else toast.error(t("share.copyFail"), t("share.copyFailDesc"));
  };

  const applyTemplate = (id: string) => {
    const tpl = TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    const { nodes, edges } = tpl.build();
    loadDoc(nodes, edges);
    setMeta({
      id: null,
      name: t(`template.${tpl.id}.name`),
      description: t(`template.${tpl.id}.desc`),
      saved: false,
    });
    setTimeout(() => fitView({ padding: 0.25 }), 40);
    toast.success(t("topbar.templateApplied"), t(`template.${tpl.id}.name`));
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border bg-background/95 p-5 shadow-lg backdrop-blur">
        <div className="mb-1 text-base font-semibold">{t("empty.title")}</div>
        <p className="mb-4 text-xs text-muted-foreground">{t("empty.desc")}</p>

        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">{t("empty.template")}</div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <Button
              key={tpl.id}
              variant="outline"
              size="sm"
              className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              onClick={() => applyTemplate(tpl.id)}
            >
              <span className="text-xs">{t(`template.${tpl.id}.name`)}</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {t(`template.${tpl.id}.desc`)}
              </span>
            </Button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setPaletteOpen(true)}>
            <LayoutGrid className="h-4 w-4" /> {t("empty.addShape")}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="h-4 w-4" /> {t("empty.shortcuts")}
          </Button>
        </div>

        <p className="mt-3 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> {t("empty.hint")}
        </p>

        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Bot className="h-3.5 w-3.5" /> {t("empty.mcpTitle")}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("empty.mcpDesc")}</p>
          <div className="mt-2 space-y-1">
            <div className="truncate rounded bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground">
              diagram mcp
            </div>
            <div className="flex items-center gap-1 truncate rounded bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground">
              <span className="text-[9px] uppercase opacity-70">{t("empty.mcpEndpoint")}</span>
              <span className="truncate">{window.location.origin}/mcp</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={copyMcp}>
              <Copy className="h-3.5 w-3.5" /> {t("empty.mcpCopy")}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" asChild>
              <a
                href="https://github.com/dolphinZzv/diagram/blob/main/docs/mcp.md"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen className="h-3.5 w-3.5" /> {t("empty.mcpDocs")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
