import { useCallback, useRef, useState } from "react";
import {
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  Image,
  Redo2,
  Save,
  Undo2,
  Upload,
  Workflow,
  Trash2,
  FileImage,
  LayoutTemplate,
  History,
  Share2,
  MoreHorizontal,
  Sun,
  Moon,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditor } from "@/lib/store";
import { exportPNG, exportSVG, exportJSON, readJSONFile } from "@/lib/exporter";
import { parseDiagramFile, serializeDoc } from "@/lib/doc";
import { TEMPLATES } from "@/lib/templates";
import { useReactFlow } from "@xyflow/react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/lib/ui";
import { OpenDialog } from "./OpenDialog";
import { VersionHistory } from "./VersionHistory";
import { ShareDialog } from "./ShareDialog";
import { AboutMenu } from "./AboutMenu";
import { useShortcuts } from "@/hooks/useShortcuts";
import { cn } from "@/lib/utils";

export function TopBar() {
  const t = useT();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);

  const meta = useEditor((s) => s.meta);
  const setMeta = useEditor((s) => s.setMeta);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const loadDoc = useEditor((s) => s.loadDoc);
  const clearAll = useEditor((s) => s.clearAll);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);

  const { getViewport, setViewport, fitView } = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);
  const [openOpen, setOpenOpen] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openShare, setOpenShare] = useState(false);

  const buildDoc = useCallback(
    () => serializeDoc(nodes, edges, meta.name, meta.description, getViewport()),
    [nodes, edges, meta.name, meta.description, getViewport]
  );

  const onSave = useCallback(
    async (forceNew = false) => {
      setMeta({ saving: true });
      try {
        const doc = buildDoc();
        if (meta.id && !forceNew) {
          await api.update(meta.id, { name: meta.name, description: meta.description, data: doc });
          setMeta({ saved: true, saving: false });
          toast.success(t("topbar.savedToast"), meta.name);
        } else {
          const created = await api.create({ name: meta.name, description: meta.description, data: doc });
          setMeta({ id: created.id, saved: true, saving: false });
          toast.success(t("topbar.createdToast"), meta.name);
        }
      } catch (e) {
        setMeta({ saving: false });
        toast.error(t("topbar.saveFail"), String(e));
      }
    },
    [buildDoc, meta.id, meta.name, meta.description, setMeta, t]
  );

  const onNew = useCallback(() => {
    if (!meta.saved && !confirm(t("topbar.confirmNew"))) return;
    loadDoc([], []);
    setMeta({ id: null, name: t("topbar.untitled"), description: "", saved: true });
    setTimeout(() => fitView({ padding: 0.3 }), 30);
  }, [meta.saved, loadDoc, setMeta, fitView, t]);

  const onApplyTemplate = useCallback(
    (id: string) => {
      const tpl = TEMPLATES.find((x) => x.id === id);
      if (!tpl) return;
      if (!meta.saved && !confirm(t("topbar.confirmTemplate"))) return;
      const { nodes: tn, edges: te } = tpl.build();
      loadDoc(tn, te);
      setMeta({ id: null, name: t(`template.${tpl.id}.name`), description: t(`template.${tpl.id}.desc`), saved: false });
      setTimeout(() => fitView({ padding: 0.25 }), 40);
      toast.success(t("topbar.templateApplied"), t(`template.${tpl.id}.name`));
    },
    [meta.saved, loadDoc, setMeta, fitView, t]
  );

  const onImport = useCallback(
    async (file: File) => {
      try {
        const raw = await readJSONFile(file);
        const doc = parseDiagramFile(raw);
        loadDoc(doc.nodes, doc.edges);
        setMeta({
          id: null,
          name: doc.name || file.name.replace(/\.json$/i, ""),
          description: doc.description || "",
          saved: false,
        });
        if (doc.viewport) setTimeout(() => setViewport(doc.viewport!), 30);
        else setTimeout(() => fitView({ padding: 0.3 }), 30);
        toast.success(t("topbar.importOk"), doc.name || file.name);
      } catch (e) {
        toast.error(t("topbar.importFail"), String(e));
      }
    },
    [loadDoc, setMeta, setViewport, fitView, t]
  );

  const onExportJSON = useCallback(() => {
    exportJSON(buildDoc(), meta.name || "diagram");
    toast.success(t("topbar.exportedJson"));
  }, [buildDoc, meta.name, t]);

  const onExportImage = useCallback(
    async (format: "png" | "svg") => {
      try {
        const name = meta.name || "diagram";
        if (format === "png") await exportPNG(nodes, edges, name, theme);
        else exportSVG(nodes, edges, name, theme);
        toast.success(t("topbar.exportedImage", { format: format.toUpperCase() }));
      } catch (e) {
        toast.error(t("topbar.exportFail"), String(e));
      }
    },
    [nodes, edges, meta.name, t, theme]
  );

  const onClear = useCallback(() => {
    if (!confirm(t("topbar.confirmClear"))) return;
    clearAll();
    toast.info(t("topbar.cleared"));
  }, [clearAll, t]);

  useShortcuts(() => onSave(false));

  const statusDot = (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.saved ? "bg-green-500" : "bg-amber-500")}
      title={meta.saving ? t("topbar.saving") : meta.saved ? t("topbar.saved") : t("topbar.unsaved")}
    />
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Workflow className="h-4 w-4" />
        </div>
      </div>

      <Input
        value={meta.name}
        onChange={(e) => setMeta({ name: e.target.value, saved: false })}
        className="h-8 min-w-0 flex-1 border-transparent bg-transparent text-sm font-medium hover:border-input focus-visible:border-input md:max-w-[180px] md:flex-none"
      />
      <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        {statusDot}
        {meta.saving ? t("topbar.saving") : meta.saved ? t("topbar.saved") : t("topbar.unsaved")}
      </span>

      {/* ---- Desktop toolbar ---- */}
      <div className="ml-auto hidden items-center gap-1 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={past.length === 0} onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("topbar.undo")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={future.length === 0} onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("topbar.redo")}</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-6 w-px bg-border" />

        <Button variant="ghost" size="sm" className="h-8" onClick={onNew}>
          <FilePlus2 className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.new")}</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpenOpen(true)}>
          <FolderOpen className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.open")}</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpenHistory(true)}>
          <History className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.history")}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <LayoutTemplate className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.templates")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{t("topbar.templateTitle")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TEMPLATES.map((tpl) => (
              <DropdownMenuItem key={tpl.id} onClick={() => onApplyTemplate(tpl.id)}>
                <div className="flex flex-col">
                  <span>{t(`template.${tpl.id}.name`)}</span>
                  <span className="text-[11px] text-muted-foreground">{t(`template.${tpl.id}.desc`)}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" className="h-8" onClick={() => onSave(false)}>
          <Save className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.save")}</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpenShare(true)}>
          <Share2 className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.share")}</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => fileInput.current?.click()}>
          <Upload className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.import")}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.export")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("topbar.exportTitle")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportJSON}>
              <FileJson className="h-4 w-4" /> {t("topbar.exportJson")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExportImage("png")}>
              <FileImage className="h-4 w-4" /> {t("topbar.exportPng")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExportImage("svg")}>
              <Image className="h-4 w-4" /> {t("topbar.exportSvg")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title={t("theme.toggle")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("theme.toggle")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("topbar.clear")}</TooltipContent>
        </Tooltip>

        <AboutMenu />
      </div>

      {/* ---- Mobile / tablet toolbar: primary actions + overflow ---- */}
      <div className="ml-auto flex items-center gap-1 md:hidden">
        {statusDot}
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={past.length === 0} onClick={undo}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onSave(false)}>
          <Save className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={redo}
              disabled={future.length === 0}
            >
              <Redo2 className="h-4 w-4" /> {t("topbar.redo")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNew}>
              <FilePlus2 className="h-4 w-4" /> {t("topbar.new")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenOpen(true)}>
              <FolderOpen className="h-4 w-4" /> {t("topbar.open")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenHistory(true)}>
              <History className="h-4 w-4" /> {t("topbar.history")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenShare(true)}>
              <Share2 className="h-4 w-4" /> {t("topbar.share")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" /> {t("topbar.import")}
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <LayoutTemplate className="h-4 w-4" /> {t("topbar.templates")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {TEMPLATES.map((tpl) => (
                  <DropdownMenuItem key={tpl.id} onClick={() => onApplyTemplate(tpl.id)}>
                    {t(`template.${tpl.id}.name`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Download className="h-4 w-4" /> {t("topbar.export")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={onExportJSON}>
                  <FileJson className="h-4 w-4" /> {t("topbar.exportJson")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportImage("png")}>
                  <FileImage className="h-4 w-4" /> {t("topbar.exportPng")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportImage("svg")}>
                  <Image className="h-4 w-4" /> {t("topbar.exportSvg")}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => useUi.getState().setShortcutsOpen(true)}>
              <Keyboard className="h-4 w-4" /> {t("shortcuts.menu")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {t("theme.toggle")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onClear}>
              <Trash2 className="h-4 w-4" /> {t("topbar.clear")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AboutMenu />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = "";
        }}
      />

      <OpenDialog open={openOpen} onOpenChange={setOpenOpen} />
      <VersionHistory open={openHistory} onOpenChange={setOpenHistory} />
      <ShareDialog open={openShare} onOpenChange={setOpenShare} />
    </header>
  );
}
