import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { LayoutGrid, SlidersHorizontal } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TopBar } from "@/components/editor/TopBar";
import { ShapePalette } from "@/components/editor/ShapePalette";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { Toaster } from "@/components/Toaster";

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/20">
          <TopBar />
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
                <LayoutGrid className="h-4 w-4" /> 添加图形
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setInspectorOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" /> 属性
              </Button>
            </div>
          </div>

          {/* Shape drawer */}
          <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
            <SheetContent side="left" className="w-[80vw] max-w-xs gap-0 p-0">
              <SheetHeader>
                <SheetTitle>添加图形</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ShapePalette onAdded={() => setPaletteOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Properties drawer */}
          <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
            <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 p-0">
              <SheetHeader>
                <SheetTitle>属性</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-hidden">
                <Inspector />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <Toaster />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}

export default App;
