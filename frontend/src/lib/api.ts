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

const base = "/api";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + url, {
    headers: { "Content-Type": "application/json" },
    ...init,
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
};
