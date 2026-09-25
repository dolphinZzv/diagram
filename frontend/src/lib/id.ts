/**
 * Generates a short unique id.
 *
 * `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost).
 * Because diagrams are commonly served over plain HTTP on a LAN IP / iPad,
 * calling it there throws "crypto.randomUUID is not a function" and silently
 * breaks adding nodes. We therefore fall back to `crypto.getRandomValues`
 * (available in insecure contexts too) and finally to Math.random.
 */
export function uid(prefix = ""): string {
  const c = globalThis.crypto as Crypto | undefined;
  let rand: string;

  if (c && typeof c.randomUUID === "function") {
    rand = c.randomUUID().replace(/-/g, "");
  } else if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    c.getRandomValues(bytes);
    rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  return prefix ? `${prefix}${rand.slice(0, 8)}` : rand;
}
