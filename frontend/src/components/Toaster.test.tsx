import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Toaster } from "@/components/Toaster";
import { useToastStore } from "@/lib/toast";

afterEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe("Toaster", () => {
  it("renders a pushed toast", () => {
    act(() => {
      useToastStore.getState().push({ title: "已保存", description: "demo", variant: "success" });
    });
    render(<Toaster />);
    expect(screen.getByText("已保存")).not.toBeNull();
    expect(screen.getByText("demo")).not.toBeNull();
  });

  it("renders nothing initially", () => {
    const { container } = render(<Toaster />);
    expect(container.querySelectorAll(".pointer-events-auto")).toHaveLength(0);
  });

  it("can dismiss a toast", () => {
    act(() => {
      useToastStore.getState().push({ title: "x" });
    });
    render(<Toaster />);
    const buttons = screen.getAllByRole("button");
    act(() => {
      buttons[buttons.length - 1].click();
    });
    expect(screen.queryByText("x")).toBeNull();
  });
});
