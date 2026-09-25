export interface ShortcutDef {
  keys: string[];
  labelKey: string;
}

export interface ShortcutGroup {
  titleKey: string;
  items: ShortcutDef[];
}

/** Central definition of keyboard shortcuts, shared by the help dialog. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: "shortcut.groupEdit",
    items: [
      { keys: ["Ctrl", "Z"], labelKey: "shortcut.undo" },
      { keys: ["Ctrl", "Shift", "Z"], labelKey: "shortcut.redo" },
      { keys: ["Ctrl", "C"], labelKey: "shortcut.copy" },
      { keys: ["Ctrl", "V"], labelKey: "shortcut.paste" },
      { keys: ["Ctrl", "D"], labelKey: "shortcut.duplicate" },
      { keys: ["Delete"], labelKey: "shortcut.delete" },
      { keys: ["Ctrl", "S"], labelKey: "shortcut.save" },
    ],
  },
  {
    titleKey: "shortcut.groupSelect",
    items: [
      { keys: ["Ctrl", "A"], labelKey: "shortcut.selectAll" },
      { keys: ["Shift", "Click"], labelKey: "shortcut.multiSelect" },
      { keys: ["Drag"], labelKey: "shortcut.marquee" },
      { keys: ["Esc"], labelKey: "shortcut.escape" },
    ],
  },
  {
    titleKey: "shortcut.groupArrange",
    items: [
      { keys: ["Ctrl", "G"], labelKey: "shortcut.group" },
      { keys: ["Ctrl", "Shift", "G"], labelKey: "shortcut.ungroup" },
      { keys: ["Ctrl", "L"], labelKey: "shortcut.lock" },
      { keys: ["Ctrl", "]"], labelKey: "shortcut.layerForward" },
      { keys: ["Ctrl", "["], labelKey: "shortcut.layerBackward" },
    ],
  },
  {
    titleKey: "shortcut.groupHelp",
    items: [{ keys: ["?"], labelKey: "shortcut.helpOpen" }],
  },
];
