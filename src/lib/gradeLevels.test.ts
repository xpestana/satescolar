import { describe, it, expect } from "vitest";
import { resolveGradeLevelKind, gradeLabel, NUMERIC_GRADES } from "./gradeLevels";

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
