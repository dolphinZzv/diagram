import { describe, expect, it } from "vitest";
import { confirmDialog, promptDialog, useDialogStore } from "./dialog";

describe("dialog store", () => {
  it("resolves a confirm request with the user's choice", async () => {
    const promise = confirmDialog({ title: "Delete?", destructive: true });
    expect(useDialogStore.getState().pending?.kind).toBe("confirm");
    useDialogStore.getState().settle(false);
    await expect(promise).resolves.toBe(false);
    expect(useDialogStore.getState().pending).toBeNull();
  });

  it("resolves a prompt with the entered value", async () => {
    const promise = promptDialog({ title: "Name", defaultValue: "x" });
    useDialogStore.getState().settle("hello");
    await expect(promise).resolves.toBe("hello");
  });

  it("resolves a cancelled prompt to null", async () => {
    const promise = promptDialog({ title: "Name" });
    useDialogStore.getState().settle(null);
    await expect(promise).resolves.toBeNull();
  });

  it("settle is a no-op when nothing is pending", () => {
    expect(() => useDialogStore.getState().settle(true)).not.toThrow();
  });
});
