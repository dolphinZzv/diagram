import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ColorField } from "./ColorField";

describe("ColorField", () => {
  it("calls onChange when a preset swatch is clicked", () => {
    const onChange = vi.fn();
    render(<ColorField value="#000000" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("#ef4444"));
    expect(onChange).toHaveBeenCalledWith("#ef4444");
  });

  it("calls onChange while typing a hex value", () => {
    const onChange = vi.fn();
    render(<ColorField value="#000000" onChange={onChange} />);
    const input = screen.getByDisplayValue("#000000");
    fireEvent.change(input, { target: { value: "#123456" } });
    expect(onChange).toHaveBeenCalledWith("#123456");
  });

  it("hides the transparent preset when not allowed", () => {
    render(<ColorField value="#000000" onChange={() => {}} allowTransparent={false} />);
    expect(screen.queryByTitle("transparent")).toBeNull();
  });

  it("shows the transparent preset by default", () => {
    render(<ColorField value="#000000" onChange={() => {}} />);
    expect(screen.getByTitle("transparent")).not.toBeNull();
  });
});
