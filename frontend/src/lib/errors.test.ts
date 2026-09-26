import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { describeError } from "./errors";
import { useI18n } from "./i18n";

beforeEach(() => {
  useI18n.setState({ lang: "en" });
});

describe("describeError", () => {
  it("maps HTTP status codes to friendly messages", () => {
    expect(describeError(new ApiError(401, "unauthorized"))).toContain("token");
    expect(describeError(new ApiError(403, "forbidden"))).toBe(
      "You don't have permission to do that."
    );
    expect(describeError(new ApiError(404, "not found"))).toBe("This item no longer exists.");
    expect(describeError(new ApiError(429, "slow down"))).toContain("Too many requests");
    expect(describeError(new ApiError(500, "boom"))).toContain("500");
  });

  it("maps fetch network failures", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toContain("Network");
  });

  it("falls back for unknown values", () => {
    expect(describeError(null)).toBe("Something went wrong. Please try again.");
  });

  it("respects the current language", () => {
    useI18n.setState({ lang: "zh" });
    expect(describeError(new ApiError(404, "x"))).toBe("对象不存在或已被删除");
  });
});
