import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/App";

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

// Guards against the "white screen" class of regression: a crash during module
// evaluation / first render, or the boot skeleton not being replaced.
describe("App smoke test", () => {
  it("mounts over the boot skeleton in #root and renders the canvas", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))
    );

    // Mimic the production index.html.
    document.body.innerHTML =
      '<div id="root"><div class="boot-skeleton"><span class="boot-skeleton__spinner"></span></div></div>';

    const container = document.getElementById("root")!;
    act(() => {
      root = createRoot(container);
      root.render(<App />);
    });

    expect(document.querySelector(".boot-skeleton")).toBeNull();
    expect(container.querySelector(".react-flow")).not.toBeNull();
    expect(container.querySelector(".react-flow__pane")).not.toBeNull();
  });
});
