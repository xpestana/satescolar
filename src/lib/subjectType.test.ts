import { describe, expect, it } from "vitest";
import {
  SUBJECT_TYPES,
  getSubjectTypeLabel,
  getSubjectTypeShortLabel,
  isSubjectType,
} from "./subjectType";

describe("subjectType", () => {
  it("labels each of the four subject types", () => {
    expect(getSubjectTypeLabel("regular")).toBe("Regular");
    expect(getSubjectTypeLabel("gcrp")).toBe("GCRP");
    expect(getSubjectTypeLabel("orientacion")).toBe("Orientación");
    expect(getSubjectTypeLabel("innovacion_tecnologica_productiva")).toBe("Innovación Tecnológica Productiva");
  });

  it("keeps Orientación and Innovación apart from Regular", () => {
    expect(getSubjectTypeShortLabel("orientacion")).toBe("Orientación");
    expect(getSubjectTypeShortLabel("innovacion_tecnologica_productiva")).toBe("ITP");
  });

  it("falls back to Regular for unknown or missing values", () => {
    expect(getSubjectTypeLabel(null)).toBe("Regular");
    expect(getSubjectTypeLabel(undefined)).toBe("Regular");
    expect(getSubjectTypeLabel("otro")).toBe("Regular");
    expect(getSubjectTypeShortLabel("")).toBe("Regular");
  });

  it("recognises only known types", () => {
    for (const type of SUBJECT_TYPES) expect(isSubjectType(type)).toBe(true);
    expect(isSubjectType("GCRP")).toBe(false);
    expect(isSubjectType(3)).toBe(false);
  });
});
