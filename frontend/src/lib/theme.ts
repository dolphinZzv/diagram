import { create } from "zustand";

export type Theme = "light" | "dark";

function detect(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem("diagram_theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: detect(),
  setTheme: (theme) => {
    try {
      localStorage.setItem("diagram_theme", theme);
    } catch {
      /* ignore */
    }
    apply(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

export function initTheme() {
  apply(useTheme.getState().theme);
}

/** Background / dots colours for the canvas, per theme. */
export function canvasColors(theme: Theme) {
  return theme === "dark"
    ? { dots: "#334155", minimapMask: "rgba(2,6,23,0.65)", exportBg: "#020617" }
    : { dots: "#cbd5e1", minimapMask: "rgba(241,245,249,0.6)", exportBg: "#ffffff" };
}
