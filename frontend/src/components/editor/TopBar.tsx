import { lazy, useCallback, useEffect, useRef, useState } from "react";
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
  Keyboard,
  FileCode2,
  Search,
  Copy,
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
import { exportPNG, exportSVG, exportJSON, readJSONFile, exportMermaid, copyImageToClipboard } from "@/lib/exporter";
import { toMermaid } from "@/lib/mermaid";
import { parseDiagramFile, serializeDoc } from "@/lib/doc";
import { TEMPLATES } from "@/lib/templates";
import { useReactFlow } from "@xyflow/react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/lib/ui";
import { AboutMenu } from "./AboutMenu";
import { useShortcuts } from "@/hooks/useShortcuts";
import { confirmDialog } from "@/lib/dialog";
import { describeError } from "@/lib/errors";
import { useDiagramActions } from "@/hooks/useDiagramActions";
import { PeerAvatars } from "./PeerAvatars";
import { usePeers } from "@/lib/peers";
import { useDocuments } from "@/lib/documents";
import { LazyDialog } from "@/components/LazyDialog";
import { cn } from "@/lib/utils";

const VersionHistory = lazy(() =>
  import("./VersionHistory").then((m) => ({ default: m.VersionHistory }))
);
const ShareDialog = lazy(() => import("./ShareDialog").then((m) => ({ default: m.ShareDialog })));

export function TopBar() {
  const t = useT();
  const theme = useTheme((s) => s.theme);

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
  const { createDiagram } = useDiagramActions();
  const fileInput = useRef<HTMLInputElement>(null);
  const [openHistory, setOpenHistory] = useState(false);
  const [openShare, setOpenShare] = useState(false);
  const documentsPanel = useUi((s) => s.documentsPanel);
  const setDocumentsPanel = useUi((s) => s.setDocumentsPanel);
  const setDocumentsDrawer = useUi((s) => s.setDocumentsDrawer);

  const buildDoc = useCallback(
    () => serializeDoc(nodes, edges, meta.name, meta.description, getViewport()),
    [nodes, edges, meta.name, meta.description, getViewport]
  );

  const onSave = useCallback(
    async (forceNew = false) => {
      setMeta({ saving: true });
      try {
        const doc = buildDoc();
        if (meta.realtime) {
          // Realtime rooms persist server-side; nothing to push explicitly.
          setMeta({ saved: true, saving: false });
          toast.success(t("topbar.savedToast"), meta.name);
        } else if (meta.editToken) {
          await api.updateEditable(meta.editToken, {
            name: meta.name,
            description: meta.description,
            data: doc,
          });
          setMeta({ saved: true, saving: false });
          toast.success(t("topbar.savedToast"), meta.name);
        } else if (meta.id && !forceNew) {
          await api.update(meta.id, { name: meta.name, description: meta.description, data: doc });
          setMeta({ saved: true, saving: false });
          toast.success(t("topbar.savedToast"), meta.name);
        } else {
          const created = await api.create({ name: meta.name, description: meta.description, data: doc });
          setMeta({ id: created.id, saved: true, saving: false });
          toast.success(t("topbar.createdToast"), meta.name);
        }
        if (!meta.editToken) void useDocuments.getState().refresh();
      } catch (e) {
        setMeta({ saving: false });
        toast.error(t("topbar.saveFail"), describeError(e));
      }
    },
    [buildDoc, meta.id, meta.name, meta.description, meta.editToken, meta.realtime, setMeta, t]
  );

  const onNew = useCallback(async () => {
    await createDiagram();
  }, [createDiagram]);

  const onApplyTemplate = useCallback(async (id: string) => {
      const tpl = TEMPLATES.find((x) => x.id === id);
      if (!tpl) return;
      if (!meta.saved && !(await confirmDialog({ title: t("topbar.confirmTemplate"), destructive: true }))) return;
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
        toast.error(t("topbar.importFail"), describeError(e));
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
        toast.error(t("topbar.exportFail"), describeError(e));
      }
    },
    [nodes, edges, meta.name, t, theme]
  );

  const onClear = useCallback(async () => {
    if (!(await confirmDialog({ title: t("topbar.confirmClear"), destructive: true }))) return;
    clearAll();
    toast.info(t("topbar.cleared"));
  }, [clearAll, t]);

  useShortcuts(() => onSave(false));

  useEffect(() => {
    const onSaveEvent = () => {
      void onSave(false);
    };
    window.addEventListener("diagram:save", onSaveEvent);
    return () => window.removeEventListener("diagram:save", onSaveEvent);
  }, [onSave]);

  const statusDot = (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.saved ? "bg-green-500" : "bg-amber-500")}
      title={meta.saving ? t("topbar.saving") : meta.saved ? t("topbar.saved") : t("topbar.unsaved")}
    />
  );

  const isSharedEdit = !!meta.editToken;
  const collabStatus = usePeers((s) => s.status);

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
      {isSharedEdit ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {t("collab.badge")}
        </span>
      ) : null}
      {meta.realtime && collabStatus !== "open" ? (
        <span
          className="hidden shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 sm:inline"
          title={t("collab.offlineHint")}
        >
          {collabStatus === "connecting" ? t("collab.connecting") : t("collab.offline")}
        </span>
      ) : null}
      <PeerAvatars />

      {/* ---- Desktop toolbar ---- */}
      <div className="ml-auto hidden items-center gap-1 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("topbar.undo")} disabled={past.length === 0} onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("topbar.undo")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("topbar.redo")} disabled={future.length === 0} onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("topbar.redo")}</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-6 w-px bg-border" />

        {!isSharedEdit ? (
          <>
        <Button variant="ghost" size="sm" className="h-8" onClick={onNew}>
          <FilePlus2 className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.new")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setDocumentsPanel(!documentsPanel)}
          title={t("docs.toggle")}
        >
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => useUi.getState().setTemplateGalleryOpen(true)}>
              <LayoutTemplate className="h-4 w-4" /> {t("topbar.browseTemplates")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          </>
        ) : null}

        <Button variant="ghost" size="sm" className="h-8" onClick={() => onSave(false)}>
          <Save className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.save")}</span>
        </Button>
        {!isSharedEdit ? (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setOpenShare(true)}>
            <Share2 className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.share")}</span>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <Upload className="h-4 w-4" /> <span className="hidden lg:inline">{t("topbar.import")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => fileInput.current?.click()}>
              <FileJson className="h-4 w-4" /> {t("topbar.importFile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useUi.getState().setImportOpen(true)}>
              <FileCode2 className="h-4 w-4" /> {t("topbar.importText")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            <DropdownMenuItem
              onClick={() => {
                exportMermaid(toMermaid(nodes, edges), meta.name || "diagram");
                toast.success(t("topbar.exportedJson"));
              }}
            >
              <FileCode2 className="h-4 w-4" /> {t("command.exportMermaid")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const r = await copyImageToClipboard(nodes, edges, theme);
                toast.success(
                  r === "copied" ? t("command.imageCopied") : t("topbar.exportedImage", { format: "PNG" })
                );
              }}
            >
              <Copy className="h-4 w-4" /> {t("command.copyImage")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("command.title")}
              onClick={() => useUi.getState().setCommandOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("command.title")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={t("topbar.clear")} onClick={onClear}>
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
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("topbar.undo")} disabled={past.length === 0} onClick={undo}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("topbar.save")} onClick={() => onSave(false)}>
          <Save className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label={t("toolbar.more")}>
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
            {!isSharedEdit ? (
              <>
            <DropdownMenuItem onClick={onNew}>
              <FilePlus2 className="h-4 w-4" /> {t("topbar.new")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDocumentsDrawer(true)}>
              <FolderOpen className="h-4 w-4" /> {t("topbar.open")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenHistory(true)}>
              <History className="h-4 w-4" /> {t("topbar.history")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenShare(true)}>
              <Share2 className="h-4 w-4" /> {t("topbar.share")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" /> {t("topbar.importFile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useUi.getState().setImportOpen(true)}>
              <FileCode2 className="h-4 w-4" /> {t("topbar.importText")}
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => useUi.getState().setTemplateGalleryOpen(true)}>
                  <LayoutTemplate className="h-4 w-4" /> {t("topbar.browseTemplates")}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
              </>
            ) : null}

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
            <DropdownMenuItem onClick={() => useUi.getState().setCommandOpen(true)}>
              <Search className="h-4 w-4" /> {t("command.title")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useUi.getState().setShortcutsOpen(true)}>
              <Keyboard className="h-4 w-4" /> {t("shortcuts.menu")}
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

      <LazyDialog open={openHistory}>
        <VersionHistory open={openHistory} onOpenChange={setOpenHistory} />
      </LazyDialog>
      <LazyDialog open={openShare}>
        <ShareDialog open={openShare} onOpenChange={setOpenShare} />
      </LazyDialog>
    </header>
  );
}
