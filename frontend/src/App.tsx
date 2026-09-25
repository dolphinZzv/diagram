import { ReactFlowProvider } from "@xyflow/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopBar } from "@/components/editor/TopBar";
import { ShapePalette } from "@/components/editor/ShapePalette";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { Toaster } from "@/components/Toaster";

function App() {
  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen flex-col overflow-hidden bg-muted/20">
          <TopBar />
          <div className="flex flex-1 overflow-hidden">
            <aside className="hidden w-[210px] shrink-0 border-r bg-background md:block">
              <ShapePalette />
            </aside>
            <main className="relative flex-1">
              <Canvas />
            </main>
            <aside className="hidden w-[290px] shrink-0 border-l bg-background lg:block">
              <Inspector />
            </aside>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}

export default App;
