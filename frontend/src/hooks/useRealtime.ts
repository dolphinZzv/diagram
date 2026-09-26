import { useEffect, useRef } from "react";
import { useReactFlow, type Edge, type Node } from "@xyflow/react";
import { useEditor } from "@/lib/store";
import { normalizeEdges, normalizeNodes } from "@/lib/doc";
import { getPeerName, usePeers } from "@/lib/peers";
import { syncEdge, syncNode, syncPending, type SyncOp } from "@/lib/syncQueue";

/**
 * Realtime collaboration for an editable-share session.
 *
 * - Local changes are diffed into element ops and queued in `syncPending`.
 * - Ops are only removed from the queue once a send succeeds, so a dropped
 *   connection never loses edits.
 * - The socket reconnects with exponential backoff; on (re)connect the server
 *   snapshot is adopted and any still-pending local edits are re-applied on top
 *   and flushed, so reconnects converge without losing local work.
 */
export function useRealtime(editToken?: string) {
  const { screenToFlowPosition } = useReactFlow();
  const setMeta = useEditor((s) => s.setMeta);

  const snapNodes = useRef(new Map<string, string>());
  const snapEdges = useRef(new Map<string, string>());
  const snapName = useRef("");
  const applying = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const flushTimer = useRef<number | undefined>(undefined);
  const lastCursor = useRef<{ x: number; y: number } | null>(null);
  const lastPresenceAt = useRef(0);

  useEffect(() => {
    if (!editToken) return;
    let disposed = false;
    let attempt = 0;
    let reconnectTimer: number | undefined;

    const send = (obj: unknown) => {
      const s = socketRef.current;
      if (s && s.readyState === WebSocket.OPEN) {
        try {
          s.send(JSON.stringify(obj));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };
    const flush = () => {
      const ops = [...syncPending.values()];
      if (ops.length === 0) {
        setMeta({ saved: true });
        return;
      }
      if (send({ t: "ops", ops })) {
        syncPending.clear();
        setMeta({ saved: true });
      }
    };
    const sendPresence = () => {
      send({ t: "presence", cursor: lastCursor.current, selection: useEditor.getState().selectedIds });
    };
    const scheduleFlush = () => {
      if (flushTimer.current) return;
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = undefined;
        flush();
      }, 50);
    };
    const applyOps = (ops: SyncOp[]) => {
      const s = useEditor.getState();
      const nodeMap = new Map(s.nodes.map((n) => [n.id, n]));
      const edgeMap = new Map(s.edges.map((e) => [e.id, e]));
      let nodesChanged = false;
      let edgesChanged = false;
      let name: string | null = null;
      for (const op of ops) {
        if (op.k === "node") {
          if (op.v == null) {
            if (nodeMap.delete(op.id)) nodesChanged = true;
            snapNodes.current.delete(op.id);
          } else {
            const prev = nodeMap.get(op.id);
            const next = {
              ...(op.v as object),
              selected: prev?.selected ?? false,
              dragging: prev?.dragging,
            } as Node;
            nodeMap.set(op.id, next);
            snapNodes.current.set(op.id, JSON.stringify(syncNode(next)));
            nodesChanged = true;
          }
        } else if (op.k === "edge") {
          if (op.v == null) {
            if (edgeMap.delete(op.id)) edgesChanged = true;
            snapEdges.current.delete(op.id);
          } else {
            const prev = edgeMap.get(op.id);
            const next = { ...(op.v as object), selected: prev?.selected ?? false } as Edge;
            edgeMap.set(op.id, next);
            snapEdges.current.set(op.id, JSON.stringify(syncEdge(next)));
            edgesChanged = true;
          }
        } else if (op.k === "meta") {
          name = op.name;
          snapName.current = op.name;
        }
      }
      if (nodesChanged || edgesChanged || name != null) {
        useEditor.setState((st) => ({
          ...(nodesChanged ? { nodes: [...nodeMap.values()] } : {}),
          ...(edgesChanged ? { edges: [...edgeMap.values()] } : {}),
          ...(name != null ? { meta: { ...st.meta, name } } : {}),
        }));
      }
    };
    const diffAndQueue = () => {
      const s = useEditor.getState();
      const nodeIds = new Set<string>();
      for (const n of s.nodes) {
        nodeIds.add(n.id);
        const key = JSON.stringify(syncNode(n));
        if (snapNodes.current.get(n.id) !== key) {
          snapNodes.current.set(n.id, key);
          syncPending.set(`node:${n.id}`, { k: "node", id: n.id, v: syncNode(n) });
        }
      }
      for (const id of [...snapNodes.current.keys()]) {
        if (!nodeIds.has(id)) {
          snapNodes.current.delete(id);
          syncPending.set(`node:${id}`, { k: "node", id, v: null });
        }
      }
      const edgeIds = new Set<string>();
      for (const e of s.edges) {
        edgeIds.add(e.id);
        const key = JSON.stringify(syncEdge(e));
        if (snapEdges.current.get(e.id) !== key) {
          snapEdges.current.set(e.id, key);
          syncPending.set(`edge:${e.id}`, { k: "edge", id: e.id, v: syncEdge(e) });
        }
      }
      for (const id of [...snapEdges.current.keys()]) {
        if (!edgeIds.has(id)) {
          snapEdges.current.delete(id);
          syncPending.set(`edge:${id}`, { k: "edge", id, v: null });
        }
      }
      if (s.meta.name !== snapName.current) {
        snapName.current = s.meta.name;
        syncPending.set("meta", { k: "meta", name: s.meta.name });
      }
      scheduleFlush();
    };
    const handleInit = (msg: { doc?: { name?: string; nodes?: unknown[]; edges?: unknown[] } }) => {
      applying.current = true;
      const serverNodes = normalizeNodes(msg.doc?.nodes ?? []);
      const serverEdges = normalizeEdges(msg.doc?.edges ?? []);
      useEditor.getState().loadDoc(serverNodes, serverEdges);
      if (msg.doc?.name) useEditor.getState().setMeta({ name: msg.doc.name });
      snapNodes.current = new Map(serverNodes.map((n) => [n.id, JSON.stringify(syncNode(n))]));
      snapEdges.current = new Map(serverEdges.map((e) => [e.id, JSON.stringify(syncEdge(e))]));
      snapName.current = useEditor.getState().meta.name;
      // Re-apply local edits that never made it to the server.
      const localOps = [...syncPending.values()];
      if (localOps.length) applyOps(localOps);
      applying.current = false;
      setMeta({ realtime: true, saving: false });
      flush();
    };

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/api/ws?token=${encodeURIComponent(editToken)}&name=${encodeURIComponent(getPeerName())}`;
      usePeers.getState().setStatus("connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        usePeers.getState().setConnected(true);
        usePeers.getState().setStatus("open");
        flush();
      };
      socket.onclose = () => {
        usePeers.getState().setConnected(false);
        if (disposed) return;
        usePeers.getState().setStatus("closed");
        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
        reconnectTimer = window.setTimeout(connect, delay);
      };
      socket.onmessage = (ev) => {
        let msg: {
          t: string;
          doc?: { name?: string; nodes?: unknown[]; edges?: unknown[] };
          ops?: SyncOp[];
          peers?: { id: string; name: string; color: string }[];
          from?: string;
          cursor?: { x: number; y: number } | null;
          selection?: string[];
          peer?: { id: string; name?: string; color?: string };
          event?: string;
        };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === "init") {
          for (const p of msg.peers ?? []) {
            usePeers.getState().upsert({ id: p.id, name: p.name, color: p.color });
          }
          handleInit(msg);
        } else if (msg.t === "ops" && msg.ops) {
          applying.current = true;
          applyOps(msg.ops);
          applying.current = false;
        } else if (msg.t === "presence" && msg.from) {
          usePeers.getState().upsert({ id: msg.from, cursor: msg.cursor ?? undefined, selection: msg.selection ?? [] });
        } else if (msg.t === "peer" && msg.peer) {
          if (msg.event === "leave") usePeers.getState().remove(msg.peer.id);
          else usePeers.getState().upsert({ id: msg.peer.id, name: msg.peer.name, color: msg.peer.color });
        }
      };
    };

    connect();

    const unsubscribe = useEditor.subscribe((state, prev) => {
      if (!applying.current) diffAndQueue();
      if (state.selectedIds !== prev.selectedIds) sendPresence();
    });

    const onMove = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".react-flow")) return;
      const now = Date.now();
      if (now - lastPresenceAt.current < 80) return;
      lastPresenceAt.current = now;
      lastCursor.current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      sendPresence();
    };
    window.addEventListener("pointermove", onMove);

    return () => {
      disposed = true;
      window.removeEventListener("pointermove", onMove);
      unsubscribe();
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try {
        socketRef.current?.close();
      } catch {
        /* ignore */
      }
      socketRef.current = null;
      syncPending.clear();
      usePeers.getState().clear();
      usePeers.getState().setConnected(false);
      useEditor.getState().setMeta({ realtime: false });
    };
  }, [editToken, screenToFlowPosition, setMeta]);
}
