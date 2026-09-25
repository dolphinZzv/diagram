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
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { CommandPalette } from "@/components/editor/CommandPalette";
import { ImportTextDialog } from "@/components/editor/ImportTextDialog";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import { SaveComponentDialog } from "@/components/editor/SaveComponentDialog";
import { ComponentLibraryDialog } from "@/components/editor/ComponentLibraryDialog";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { SelectionActionsBar } from "@/components/editor/SelectionActionsBar";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui";
import { useDraftPersistence } from "@/hooks/useDraft";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useShareSync } from "@/hooks/useShareSync";
import { useClipboardPaste } from "@/hooks/useClipboardPaste";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/Toaster";

function EditorApp() {
  const t = useT();
  useDraftPersistence();
  useAutoSave();
  useShareSync();
  useClipboardPaste();
  const sketch = useUi((s) => s.sketch);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const inspectorOpen = useUi((s) => s.inspectorOpen);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);
  const selectMode = useUi((s) => s.selectMode);
  const setSelectMode = useUi((s) => s.setSelectMode);

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
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[210px] shrink-0 border-r bg-background lg:block">
          <ShapePalette />
        </aside>
        <main className="relative flex-1">
          <Canvas />
        </main>
        <aside className="hidden w-[290px] shrink-0 border-l bg-background lg:block">
          <Inspector />
        </aside>
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
      <ShortcutsDialog />
      <CommandPalette />
      <ImportTextDialog />
      <TemplateGallery />
      <SaveComponentDialog />
      <ComponentLibraryDialog />
    </div>
  );
}

function App() {
  // Read-only share mode: /?share=<token>
  const shareToken = new URLSearchParams(window.location.search).get("share");
  if (shareToken) {
    return (
      <>
        <SharedView token={shareToken} />
        <Toaster />
      </>
    );
  }

  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={300}>
        <EditorApp />
        <Toaster />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}

export default App;
