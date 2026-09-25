import { useEffect } from "react";
import { useComponents } from "@/lib/components";

/** Pulls the shared component library from the server once on startup. */
export function useComponentSync() {
  useEffect(() => {
    void useComponents.getState().syncFromServer();
  }, []);
}
