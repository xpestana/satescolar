import { describe, it, expect } from "vitest";
import type { ModuleKey } from "./moduleCatalog";
import { isRequirementMet, pitchedModule, requirementModules, TEACHING_MODULES } from "./moduleRequirement";

const activeOnly = (...keys: ModuleKey[]) => (key: ModuleKey) => keys.includes(key);

describe("moduleRequirement", () => {
  it("treats a single key as a one-item requirement", () => {
    expect(requirementModules("payments")).toEqual(["payments"]);
    expect(isRequirementMet("payments", activeOnly("payments"))).toBe(true);
    expect(isRequirementMet("payments", activeOnly("grades"))).toBe(false);
  });

  it("is met when any module of a list is active", () => {
    expect(isRequirementMet(TEACHING_MODULES, activeOnly("virtual_classroom"))).toBe(true);
    expect(isRequirementMet(TEACHING_MODULES, activeOnly("attendance"))).toBe(true);
    expect(isRequirementMet(TEACHING_MODULES, activeOnly("payments", "messaging"))).toBe(false);
  });

  it("pitches the first module of the requirement", () => {
    expect(pitchedModule(TEACHING_MODULES)).toBe("grades");
    expect(pitchedModule("attendance")).toBe("attendance");
    expect(pitchedModule([])).toBe("registration");
  });
});
