import { TONES } from "@/components/editor/icons";

export interface DiagramPalette {
  nameKey: string;
  tones: (keyof typeof TONES)[];
}

/** Whole-diagram color themes. */
export const DIAGRAM_PALETTES: Record<string, DiagramPalette> = {
  ocean: { nameKey: "palette.ocean", tones: ["blue", "indigo", "purple", "teal", "slate"] },
  forest: { nameKey: "palette.forest", tones: ["green", "teal", "amber", "orange", "slate"] },
  sunset: { nameKey: "palette.sunset", tones: ["orange", "red", "pink", "amber", "purple"] },
  mono: { nameKey: "palette.mono", tones: ["slate"] },
};

/** Returns the tone for the Nth node of a palette (cycling). */
export function paletteTone(paletteKey: string, index: number) {
  const palette = DIAGRAM_PALETTES[paletteKey];
  if (!palette) return null;
  const key = palette.tones[index % palette.tones.length];
  return TONES[key] ?? TONES.slate;
}
