import { lazy } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { LayoutGrid, SlidersHorizontal, SquareDashed } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TopBar } from "@/components/editor/TopBar";
import { ShapePalette } from "@/components/editor/ShapePalette";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { SharedView } from "@/components/editor/SharedView";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { SelectionActionsBar } from "@/components/editor/SelectionActionsBar";
import { DocumentsPanel } from "@/components/editor/DocumentsPanel";
import { CollapsedRail } from "@/components/editor/CollapsedRail";
import { SubgraphBreadcrumb } from "@/components/editor/SubgraphBreadcrumb";
import { LazyDialog } from "@/components/LazyDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui";
import { useDraftPersistence } from "@/hooks/useDraft";
import { useDocumentBootstrap } from "@/hooks/useDocumentBootstrap";
import { useRealtime } from "@/hooks/useRealtime";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useShareSync } from "@/hooks/useShareSync";
import { useClipboardPaste } from "@/hooks/useClipboardPaste";
import { useComponentSync } from "@/hooks/useComponentSync";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/Toaster";

// Optional dialogs are code-split: their (sometimes heavy) dependencies are not
// part of the initial bundle.
const ShortcutsDialog = lazy(() =>
  import("@/components/editor/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog }))
);
const CommandPalette = lazy(() =>
  import("@/components/editor/CommandPalette").then((m) => ({ default: m.CommandPalette }))
);
const ImportTextDialog = lazy(() =>
  import("@/components/editor/ImportTextDialog").then((m) => ({ default: m.ImportTextDialog }))
);
const TemplateGallery = lazy(() =>
  import("@/components/editor/TemplateGallery").then((m) => ({ default: m.TemplateGallery }))
);
const SaveComponentDialog = lazy(() =>
  import("@/components/editor/SaveComponentDialog").then((m) => ({ default: m.SaveComponentDialog }))
);
const ComponentLibraryDialog = lazy(() =>
  import("@/components/editor/ComponentLibraryDialog").then((m) => ({
    default: m.ComponentLibraryDialog,
  }))
);
const McpDialog = lazy(() =>
  import("@/components/editor/McpDialog").then((m) => ({ default: m.McpDialog }))
);
const SubgraphPickerDialog = lazy(() =>
  import("@/components/editor/SubgraphPickerDialog").then((m) => ({
    default: m.SubgraphPickerDialog,
  }))
);

function EditorApp({ editToken }: { editToken?: string }) {
  const t = useT();
  useDraftPersistence();
  useDocumentBootstrap(editToken);
  useRealtime(editToken);
  useAutoSave();
  useShareSync();
  useClipboardPaste();
  useComponentSync();
  const sketch = useUi((s) => s.sketch);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const inspectorOpen = useUi((s) => s.inspectorOpen);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);
  const selectMode = useUi((s) => s.selectMode);
  const setSelectMode = useUi((s) => s.setSelectMode);
  const documentsPanel = useUi((s) => s.documentsPanel);
  const setDocumentsPanel = useUi((s) => s.setDocumentsPanel);
  const shapesPanel = useUi((s) => s.shapesPanel);
  const setShapesPanel = useUi((s) => s.setShapesPanel);
  const inspectorPanel = useUi((s) => s.inspectorPanel);
  const setInspectorPanel = useUi((s) => s.setInspectorPanel);
  const documentsDrawer = useUi((s) => s.documentsDrawer);
  const setDocumentsDrawer = useUi((s) => s.setDocumentsDrawer);
  const shortcutsOpen = useUi((s) => s.shortcutsOpen);
  const commandOpen = useUi((s) => s.commandOpen);
  const importOpen = useUi((s) => s.importOpen);
  const templateGalleryOpen = useUi((s) => s.templateGalleryOpen);
  const saveComponentOpen = useUi((s) => s.saveComponentOpen);
  const componentLibraryOpen = useUi((s) => s.componentLibraryOpen);
  const mcpOpen = useUi((s) => s.mcpOpen);
  const subgraphPickerOpen = useUi((s) => s.subgraphPickerOpen);

  return (
    <div className={cn("flex h-[100dvh] flex-col overflow-hidden bg-muted/20", sketch && "sketch")}>
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
        <filter id="diagram-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <TopBar />
      <SelectionActionsBar />
      <SubgraphBreadcrumb />
      <div className="flex flex-1 overflow-hidden">
        {!editToken && documentsPanel ? (
          <aside className="hidden w-[230px] shrink-0 border-r bg-background lg:block">
            <DocumentsPanel onCollapse={() => setDocumentsPanel(false)} />
          </aside>
        ) : !editToken ? (
          <CollapsedRail side="left" label={t("docs.title")} onExpand={() => setDocumentsPanel(true)} />
        ) : null}
        {shapesPanel ? (
          <aside className="hidden w-[210px] shrink-0 border-r bg-background lg:block">
            <ShapePalette onCollapse={() => setShapesPanel(false)} />
          </aside>
        ) : (
          <CollapsedRail
            side="left"
            label={t("palette.panelTitle")}
            onExpand={() => setShapesPanel(true)}
          />
        )}
        <main className="relative flex-1">
          <Canvas />
        </main>
        {inspectorPanel ? (
          <aside className="hidden w-[290px] shrink-0 border-l bg-background lg:block">
            <Inspector onCollapse={() => setInspectorPanel(false)} />
          </aside>
        ) : (
          <CollapsedRail
            side="right"
            label={t("inspector.panelTitle")}
            onExpand={() => setInspectorPanel(true)}
          />
        )}
      </div>

      {/* Floating toolbar for phones / tablets */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="pointer-events-auto flex gap-1.5 rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur">
          <Button size="sm" className="rounded-full" onClick={() => setPaletteOpen(true)}>
            <LayoutGrid className="h-4 w-4" /> {t("palette.addTitle")}
          </Button>
          <Button
            size="sm"
            variant={selectMode ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setSelectMode(!selectMode)}
            title={t("toolbar.selectModeHint")}
          >
            <SquareDashed className="h-4 w-4" /> {t("toolbar.selectMode")}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setInspectorOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> {t("inspector.panelTitle")}
          </Button>
        </div>
      </div>

      {!editToken ? (
        <Sheet open={documentsDrawer} onOpenChange={setDocumentsDrawer}>
          <SheetContent side="left" className="w-[85vw] max-w-xs gap-0 p-0">
            <DocumentsPanel onOpened={() => setDocumentsDrawer(false)} />
          </SheetContent>
        </Sheet>
      ) : null}

      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="left" className="w-[80vw] max-w-xs gap-0 p-0">
          <SheetHeader>
            <SheetTitle>{t("palette.addTitle")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ShapePalette onAdded={() => setPaletteOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 p-0">
          <SheetHeader>
            <SheetTitle>{t("inspector.panelTitle")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Inspector />
          </div>
        </SheetContent>
      </Sheet>

      <SelectionToolbar />
      <LazyDialog open={shortcutsOpen}>
        <ShortcutsDialog />
      </LazyDialog>
      <LazyDialog open={commandOpen}>
        <CommandPalette />
      </LazyDialog>
      <LazyDialog open={importOpen}>
        <ImportTextDialog />
      </LazyDialog>
      <LazyDialog open={templateGalleryOpen}>
        <TemplateGallery />
      </LazyDialog>
      <LazyDialog open={saveComponentOpen}>
        <SaveComponentDialog />
      </LazyDialog>
      <LazyDialog open={componentLibraryOpen}>
        <ComponentLibraryDialog />
      </LazyDialog>
      <LazyDialog open={mcpOpen}>
        <McpDialog />
      </LazyDialog>
      <LazyDialog open={subgraphPickerOpen}>
        <SubgraphPickerDialog />
      </LazyDialog>
      <ConfirmDialog />
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  // Read-only share mode: /?share=<token>
  const shareToken = params.get("share");
  if (shareToken) {
    return (
      <>
        <SharedView token={shareToken} />
        <Toaster />
        <ConfirmDialog />
      </>
    );
  }
  // Editable share mode: /?edit=<token>
  const editToken = params.get("edit") ?? undefined;

  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={300}>
        <EditorApp editToken={editToken} />
        <Toaster />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}

export default App;
