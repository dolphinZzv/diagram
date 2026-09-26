import { usePeers } from "@/lib/peers";

/** Colored avatars for the other people currently in the collaboration room. */
export function PeerAvatars() {
  const peers = usePeers((s) => s.peers);
  const connected = usePeers((s) => s.connected);
  const list = Object.values(peers);
  if (!connected && list.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center -space-x-1.5">
      {list.slice(0, 5).map((p) => (
        <span
          key={p.id}
          title={p.name}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
          style={{ background: p.color }}
        >
          {p.name.replace(/^User\s*/i, "").slice(0, 2).toUpperCase()}
        </span>
      ))}
      {list.length > 5 ? (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
          +{list.length - 5}
        </span>
      ) : null}
    </div>
  );
}
