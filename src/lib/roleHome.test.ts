import { describe, expect, it } from "vitest";
import { roleHomePath } from "./roleHome";
import type { AppRole } from "./userContext";

describe("roleHomePath", () => {
  it("sends each role to its own dashboard", () => {
    expect(roleHomePath("admin")).toBe("/dashboard");
    expect(roleHomePath("school")).toBe("/school/dashboard");
    expect(roleHomePath("representative")).toBe("/representative/dashboard");
    expect(roleHomePath("teacher")).toBe("/teacher/dashboard");
  });

  it("falls back to login without a known role", () => {
    expect(roleHomePath(null)).toBe("/login");
    expect(roleHomePath(undefined)).toBe("/login");
    expect(roleHomePath("ghost" as AppRole)).toBe("/login");
  });
});
