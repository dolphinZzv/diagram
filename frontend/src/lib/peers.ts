import { create } from "zustand";

export interface Peer {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection: string[];
  updatedAt: number;
}

interface PeersState {
  peers: Record<string, Peer>;
  connected: boolean;
  /** Connection lifecycle: connecting | open | closed (reconnecting). */
  status: "connecting" | "open" | "closed";
  setConnected: (v: boolean) => void;
  setStatus: (v: "connecting" | "open" | "closed") => void;
  upsert: (p: Partial<Peer> & { id: string }) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/** Presence of other collaborators in the current realtime session. */
export const usePeers = create<PeersState>((set, get) => ({
  peers: {},
  connected: false,
  status: "connecting",
  setConnected: (v) => set({ connected: v }),
  setStatus: (v) => set({ status: v }),
  upsert: (p) => {
    const prev = get().peers[p.id];
    set({
      peers: {
        ...get().peers,
        [p.id]: {
          id: p.id,
          name: p.name ?? prev?.name ?? "Guest",
          color: p.color ?? prev?.color ?? "#64748b",
          cursor: p.cursor !== undefined ? p.cursor : prev?.cursor,
          selection: p.selection ?? prev?.selection ?? [],
          updatedAt: Date.now(),
        },
      },
    });
  },
  remove: (id) => {
    const next = { ...get().peers };
    delete next[id];
    set({ peers: next });
  },
  clear: () => set({ peers: {} }),
}));

/** A stable display name for this browser, reused across sessions. */
export function getPeerName(): string {
  try {
    let n = localStorage.getItem("diagram_peer_name");
    if (!n) {
      n = "User " + Math.random().toString(36).slice(2, 6);
      localStorage.setItem("diagram_peer_name", n);
    }
    return n;
  } catch {
    return "User";
  }
}
