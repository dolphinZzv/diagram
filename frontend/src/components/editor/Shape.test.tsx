import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Shape } from "./Shape";

const base = { width: 100, height: 60, fill: "#ffffff", stroke: "#000000", strokeWidth: 2 };

describe("Shape", () => {
  it("renders a rect for rect and rounded", () => {
    expect(render(<Shape shape="rect" {...base} />).container.querySelector("rect")).not.toBeNull();
    expect(render(<Shape shape="rounded" {...base} />).container.querySelector("rect")).not.toBeNull();
  });

  it("renders an ellipse", () => {
    expect(render(<Shape shape="ellipse" {...base} />).container.querySelector("ellipse")).not.toBeNull();
  });

  it("renders polygons for angular shapes", () => {
    for (const shape of ["diamond", "hexagon", "triangle", "parallelogram", "star"] as const) {
      const poly = render(<Shape shape={shape} {...base} />).container.querySelector("polygon");
      expect(poly, shape).not.toBeNull();
    }
  });

  it("renders a path for document and cloud", () => {
    expect(render(<Shape shape="document" {...base} />).container.querySelector("path")).not.toBeNull();
    expect(render(<Shape shape="cloud" {...base} />).container.querySelector("path")).not.toBeNull();
  });

  it("renders a cylinder as a path plus an ellipse", () => {
    const { container } = render(<Shape shape="cylinder" {...base} />);
    expect(container.querySelector("path")).not.toBeNull();
    expect(container.querySelector("ellipse")).not.toBeNull();
  });

  it("renders nothing for the text shape", () => {
    const { container } = render(<Shape shape="text" {...base} />);
    expect(container.querySelector("svg, rect, path, ellipse, polygon, g")).toBeNull();
  });

  it("honours a transparent fill", () => {
    const { container } = render(<Shape shape="rect" {...base} fill="transparent" />);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("none");
  });
});
