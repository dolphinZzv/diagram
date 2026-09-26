import { useEffect } from "react";
import { installAgentTools } from "@/lib/webmcp";

/**
 * Registers the editor's agent tools (WebMCP when available, plus the
 * `window.diagramAgent` fallback) for the lifetime of the editor.
 */
export function useAgentTools() {
  useEffect(() => installAgentTools(), []);
}
