import { agentTools, callAgentTool } from "./agentTools";

/**
 * Bridges the editor's agent tools to the in-browser agent APIs.
 *
 * - WebMCP (`navigator.modelContext`, experimental in Edge; API still moving)
 *   is used when present, so a browser agent can drive the editor directly.
 * - `window.diagramAgent` is always exposed as a stable escape hatch for
 *   extensions, bookmarklets, the console, or agents without WebMCP support.
 *
 * Everything runs against the local editor store, so actions are undoable.
 */

interface McTool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (args: Record<string, unknown>) => unknown;
}

interface ModelContext {
  registerTool?: (tool: McTool) => void;
  unregisterTool?: (name: string) => void;
  provideContext?: (ctx: { tools: McTool[] }) => void;
}

declare global {
  interface Window {
    diagramAgent?: {
      version: string;
      tools: { name: string; description: string }[];
      call: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

/** True when the browser exposes a (experimental) WebMCP model context. */
export function webMcpAvailable(): boolean {
  const nav = navigator as unknown as { modelContext?: ModelContext; modelContextTesting?: ModelContext };
  return !!(nav.modelContext || nav.modelContextTesting);
}

export function installAgentTools(): () => void {
  window.diagramAgent = {
    version: "1",
    tools: agentTools.map((t) => ({ name: t.name, description: t.description })),
    call: (name, args) => callAgentTool(name, args),
  };

  const nav = navigator as unknown as { modelContext?: ModelContext; modelContextTesting?: ModelContext };
  const mc = nav.modelContext ?? nav.modelContextTesting;
  const disposers: (() => void)[] = [];

  if (mc) {
    const tools: McTool[] = agentTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      execute: (args) => callAgentTool(t.name, args ?? {}),
    }));
    try {
      if (typeof mc.registerTool === "function") {
        for (const t of tools) {
          mc.registerTool(t);
          disposers.push(() => mc.unregisterTool?.(t.name));
        }
      } else if (typeof mc.provideContext === "function") {
        mc.provideContext({ tools });
        disposers.push(() => mc.provideContext?.({ tools: [] }));
      }
    } catch {
      /* experimental API: never break the editor if registration fails */
    }
  }

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        /* ignore */
      }
    }
    try {
      delete window.diagramAgent;
    } catch {
      /* ignore */
    }
  };
}
