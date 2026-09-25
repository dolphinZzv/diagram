import { afterEach, describe, expect, it } from "vitest";
import { uid } from "./id";

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
});

describe("uid", () => {
  it("generates distinct ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });

  it("applies the prefix", () => {
    expect(uid("n_").startsWith("n_")).toBe(true);
    expect(uid("e_").startsWith("e_")).toBe(true);
  });

  // Regression: served over plain HTTP (LAN IP / iPad), crypto.randomUUID is
  // undefined. Adding nodes used to throw and silently fail.
  it("works without crypto.randomUUID (insecure context)", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 256;
          return arr;
        },
      },
      configurable: true,
    });
    expect(uid("e_")).toMatch(/^e_[0-9a-f]{8}$/);
  });

  it("works when crypto is entirely unavailable", () => {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    expect(uid().length).toBeGreaterThan(0);
    expect(uid("n_").startsWith("n_")).toBe(true);
  });
});
