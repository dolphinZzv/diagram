import { create } from "zustand";
import { api, type DiagramListItem } from "./api";

/**
 * Client-side cache of the server's diagram list, shared by the left
 * navigation panel and the toolbar so multiple diagrams can be managed and
 * switched without refetching on every render.
 */
interface DocumentsState {
  items: DiagramListItem[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (name: string, description: string, data: unknown) => Promise<DiagramListItem>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (id: string, name: string) => Promise<DiagramListItem>;
}

export const useDocuments = create<DocumentsState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const items = await api.list();
      set({ items, loading: false, loaded: true });
    } catch (e) {
      set({ loading: false, loaded: true, error: e instanceof Error ? e.message : String(e) });
    }
  },

  create: async (name, description, data) => {
    const rec = await api.create({ name, description, data });
    await get().refresh();
    return rec;
  },

  remove: async (id) => {
    await api.remove(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  rename: async (id, name) => {
    const rec = await api.get(id);
    await api.update(id, { name, description: rec.description, data: rec.data });
    set({ items: get().items.map((i) => (i.id === id ? { ...i, name } : i)) });
  },

  duplicate: async (id, name) => {
    const rec = await api.get(id);
    const created = await api.create({ name, description: rec.description, data: rec.data });
    await get().refresh();
    return created;
  },
}));
