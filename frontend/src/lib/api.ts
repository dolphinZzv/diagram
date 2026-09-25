export interface DiagramListItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramRecord extends DiagramListItem {
  data: { nodes: unknown[]; edges: unknown[]; viewport?: { x: number; y: number; zoom: number } };
}

export interface DiagramVersion {
  id: number;
  diagramId: string;
  version: number;
  label: string;
  origin: string; // create | auto | manual | restore
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  data?: { nodes: unknown[]; edges: unknown[]; viewport?: { x: number; y: number; zoom: number } };
}

export interface SharedDiagram {
  name: string;
  description: string;
  data: { nodes: unknown[]; edges: unknown[]; viewport?: { x: number; y: number; zoom: number } };
  updatedAt: string;
}

export interface ShareState {
  enabled: boolean;
  token: string;
}

export interface PublishState {
  published: boolean;
  publishedAt: string;
  dirty: boolean;
}

const base = "/api";

/** Token is stored in localStorage and sent as a Bearer header when the
 * server was started with DIAGRAM_TOKEN. */
export function getToken(): string {
  try {
    return localStorage.getItem("diagram_token") ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string): void {
  try {
    if (token) localStorage.setItem("diagram_token", token);
    else localStorage.removeItem("diagram_token");
  } catch {
    /* ignore */
  }
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + url, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: () => req<DiagramListItem[]>("/diagrams"),
  get: (id: string) => req<DiagramRecord>(`/diagrams/${id}`),
  create: (body: { name: string; description?: string; data: unknown }) =>
    req<DiagramRecord>("/diagrams", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { name: string; description?: string; data: unknown }) =>
    req<DiagramRecord>(`/diagrams/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => req<{ status: string }>(`/diagrams/${id}`, { method: "DELETE" }),

  // ---- version history ----
  listVersions: (id: string) => req<DiagramVersion[]>(`/diagrams/${id}/versions`),
  getVersion: (id: string, version: number) =>
    req<DiagramVersion>(`/diagrams/${id}/versions/${version}`),
  createVersion: (id: string, label: string) =>
    req<DiagramVersion>(`/diagrams/${id}/versions`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  restoreVersion: (id: string, version: number) =>
    req<{ diagram: DiagramRecord; version: DiagramVersion }>(
      `/diagrams/${id}/versions/${version}/restore`,
      { method: "POST" }
    ),
  removeVersion: (id: string, version: number) =>
    req<{ status: string }>(`/diagrams/${id}/versions/${version}`, { method: "DELETE" }),

  // ---- sharing (read-only public link) ----
  getShare: (id: string) => req<ShareState>(`/diagrams/${id}/share`),
  enableShare: (id: string) => req<ShareState>(`/diagrams/${id}/share`, { method: "POST" }),
  disableShare: (id: string) => req<ShareState>(`/diagrams/${id}/share`, { method: "DELETE" }),
  getShared: (token: string) => req<SharedDiagram>(`/share/${token}`),

  // ---- draft / publish ----
  getPublish: (id: string) => req<PublishState>(`/diagrams/${id}/publish`),
  publish: (id: string) =>
    req<{ published: boolean; publishedAt: string }>(`/diagrams/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) => req<{ published: boolean }>(`/diagrams/${id}/publish`, { method: "DELETE" }),

  // Uploads a client-rendered image for a share token (raw bytes body).
  uploadShareImage: async (id: string, format: "svg" | "png", blob: Blob) => {
    const res = await fetch(`/api/diagrams/${id}/share/image?format=${format}`, {
      method: "PUT",
      headers: {
        "Content-Type": format === "png" ? "image/png" : "image/svg+xml",
        ...authHeaders(),
      },
      body: blob,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as { format: string; bytes: number };
  },
};
