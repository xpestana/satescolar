import { describe, it, expect } from "vitest";
import {
  resolveGradeLevelKind,
  gradeLabel,
  formatSectionLabel,
  formatGradeSectionLabel,
  sectionDisplayName,
  sectionFileToken,
  NUMERIC_GRADES,
} from "./gradeLevels";

describe("resolveGradeLevelKind", () => {
  it("maps preschool grades", () => {
    for (const g of ["pre_maternal", "maternal", "i_nivel", "ii_nivel", "iii_nivel"]) {
      expect(resolveGradeLevelKind(g)).toBe("preschool");
    }
  });

  it("maps primary grades", () => {
    for (const g of ["1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado"]) {
      expect(resolveGradeLevelKind(g)).toBe("primary");
    }
  });

  it("maps secondary grades", () => {
    for (const g of ["media_general", "1_ano", "5_ano", "media_tecnica", "6_ano"]) {
      expect(resolveGradeLevelKind(g)).toBe("secondary");
    }
  });

  it("falls back to unknown for missing or unmapped grades", () => {
    expect(resolveGradeLevelKind(null)).toBe("unknown");
    expect(resolveGradeLevelKind(undefined)).toBe("unknown");
    expect(resolveGradeLevelKind("")).toBe("unknown");
    // `primaria` and `inicial` are display-only buckets, not sections a student is enrolled in.
    expect(resolveGradeLevelKind("primaria")).toBe("unknown");
    expect(resolveGradeLevelKind("universidad")).toBe("unknown");
  });
});

describe("gradeLabel", () => {
  it("returns the human label", () => {
    expect(gradeLabel("3_grado")).toBe("3er Grado");
    expect(gradeLabel("media_tecnica")).toBe("Media Técnica");
  });

  it("echoes unknown keys and empties nullish input", () => {
    expect(gradeLabel("xyz")).toBe("xyz");
    expect(gradeLabel(null)).toBe("");
  });
});

describe("NUMERIC_GRADES", () => {
  it("covers secondary only", () => {
    expect(NUMERIC_GRADES.has("1_ano")).toBe(true);
    expect(NUMERIC_GRADES.has("1_grado")).toBe(false);
    expect(NUMERIC_GRADES.has("i_nivel")).toBe(false);
  });
});

describe("formatSectionLabel", () => {
  it("joins the grade label and the section name", () => {
    expect(formatSectionLabel({ grade_level: "4_grado", name: "U" })).toBe("4to Grado - Sección U");
    expect(formatSectionLabel(null)).toBe("");
  });

  it("marks technical sections", () => {
    expect(formatSectionLabel({ grade_level: "1_ano", name: "A", is_technical: true })).toBe(
      "1er Año - Sección A (Técnica)",
    );
  });
});

describe("sectionDisplayName", () => {
  it("returns the plain name for non-technical sections", () => {
    expect(sectionDisplayName({ name: "B", is_technical: false })).toBe("B");
    expect(sectionDisplayName({ name: "B", is_technical: null })).toBe("B");
    expect(sectionDisplayName({ name: "B" })).toBe("B");
  });

  it("appends the technical suffix", () => {
    expect(sectionDisplayName({ name: "C", is_technical: true })).toBe("C (Técnica)");
  });

  it("empties nullish sections", () => {
    expect(sectionDisplayName(null)).toBe("");
    expect(sectionDisplayName(undefined)).toBe("");
  });
});

describe("formatGradeSectionLabel", () => {
  it("joins grade and section without the word Sección", () => {
    expect(formatGradeSectionLabel({ grade_level: "6_ano", name: "A" })).toBe("6to Año - A");
    expect(formatGradeSectionLabel({ grade_level: "1_ano", name: "A", is_technical: true })).toBe(
      "1er Año - A (Técnica)",
    );
    expect(formatGradeSectionLabel(null)).toBe("");
  });
});

describe("sectionFileToken", () => {
  it("keeps regular and technical sections apart in file names", () => {
    expect(sectionFileToken({ name: "A" })).toBe("A");
    expect(sectionFileToken({ name: "A", is_technical: true })).toBe("A_Tecnica");
    expect(sectionFileToken(null)).toBe("");
  });
});
