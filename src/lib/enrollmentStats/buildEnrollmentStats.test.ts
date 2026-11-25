import { describe, it, expect } from "vitest";
import { buildEnrollmentStats, compareSections } from "./buildEnrollmentStats";
import type { DemographicsRow, StatsSection } from "./enrollmentStatsTypes";

const sections: StatsSection[] = [
  { id: "s2a", name: "A", grade_level: "2_ano", is_technical: false },
  { id: "s1at", name: "A", grade_level: "1_ano", is_technical: true },
  { id: "s1a", name: "A", grade_level: "1_ano", is_technical: false },
  { id: "s1b", name: "B", grade_level: "1_ano", is_technical: false },
];

const row = (
  section_id: string,
  age: number | null,
  sex: DemographicsRow["sex"],
  document_kind: string | null,
  total: number,
): DemographicsRow => ({ section_id, age, sex, document_kind, total });

const rows: DemographicsRow[] = [
  row("s1a", 11, "male", "CI", 8),
  row("s1a", 11, "female", "CI", 5),
  row("s1a", 12, "male", "CE", 2),
  row("s1at", 12, "female", "CI", 3),
  row("s2a", 13, "male", "P", 1),
  row("s2a", null, null, null, 2),
];

const ALL = { gradeLevel: null, sectionId: null };

describe("compareSections", () => {
  it("orders by grade, then letter, técnica after its regular twin", () => {
    const ids = [...sections].sort(compareSections).map((s) => s.id);
    expect(ids).toEqual(["s1a", "s1at", "s1b", "s2a"]);
  });
});

describe("buildEnrollmentStats", () => {
  it("returns empty blocks without rows", () => {
    const stats = buildEnrollmentStats([], sections, ALL);
    expect(stats.total.bySex).toEqual({ male: 0, female: 0, unknown: 0, total: 0 });
    expect(stats.total.ages).toEqual([]);
    expect(stats.sectionBlocks).toHaveLength(4);
    expect(stats.hasUnknownAge).toBe(false);
  });

  it("totals by age and sex per section with a shared age scale", () => {
    const stats = buildEnrollmentStats(rows, sections, ALL);
    const s1a = stats.sectionBlocks.find((b) => b.key === "section:s1a")!;
    expect(s1a.title).toBe("1er Año - A");
    expect(s1a.ages.map((a) => a.age)).toEqual([11, 12, 13, null]);
    expect(s1a.ages[0].counts).toEqual({ male: 8, female: 5, unknown: 0, total: 13 });
    expect(s1a.ages[2].counts.total).toBe(0);
    expect(s1a.bySex).toEqual({ male: 10, female: 5, unknown: 0, total: 15 });
    expect(s1a.byDocument).toEqual({ CI: 13, CE: 2, P: 0, unknown: 0 });
  });

  it("keeps sections without students as empty blocks", () => {
    const stats = buildEnrollmentStats(rows, sections, ALL);
    expect(stats.sectionBlocks.find((b) => b.key === "section:s1b")!.bySex.total).toBe(0);
  });

  it("counts missing sex, age and document", () => {
    const stats = buildEnrollmentStats(rows, sections, ALL);
    expect(stats.total.bySex).toEqual({ male: 11, female: 8, unknown: 2, total: 21 });
    expect(stats.total.byDocument).toEqual({ CI: 16, CE: 2, P: 1, unknown: 2 });
    expect(stats.hasUnknownSex).toBe(true);
    expect(stats.hasUnknownAge).toBe(true);
    expect(stats.total.ages.at(-1)).toEqual({ age: null, counts: { male: 0, female: 0, unknown: 2, total: 2 } });
  });

  it("splits Media General and Media Técnica", () => {
    const stats = buildEnrollmentStats(rows, sections, ALL);
    const general = stats.groupBlocks.find((b) => b.key === "group:general")!;
    const technical = stats.groupBlocks.find((b) => b.key === "group:technical")!;
    expect(general.bySex.total).toBe(18);
    expect(technical.bySex).toEqual({ male: 0, female: 3, unknown: 0, total: 3 });
  });

  it("adds one block per grade only when no grade is selected", () => {
    expect(buildEnrollmentStats(rows, sections, ALL).gradeBlocks.map((b) => b.title)).toEqual([
      "1er Año",
      "2do Año",
    ]);
    expect(buildEnrollmentStats(rows, sections, { gradeLevel: "1_ano", sectionId: null }).gradeBlocks).toEqual([]);
  });

  it("filters by grade and by section", () => {
    const grade = buildEnrollmentStats(rows, sections, { gradeLevel: "1_ano", sectionId: null });
    expect(grade.sectionIds).toEqual(["s1a", "s1at", "s1b"]);
    expect(grade.total.bySex.total).toBe(18);
    expect(grade.hasUnknownAge).toBe(false);

    const section = buildEnrollmentStats(rows, sections, { gradeLevel: "1_ano", sectionId: "s1at" });
    expect(section.sectionBlocks).toHaveLength(1);
    expect(section.total.bySex.total).toBe(3);
    expect(section.groupBlocks.find((b) => b.key === "group:general")!.bySex.total).toBe(0);
  });

  it("ignores rows of sections that no longer exist", () => {
    const stats = buildEnrollmentStats([row("gone", 10, "male", "CI", 4)], sections, ALL);
    expect(stats.total.bySex.total).toBe(0);
  });

  it("adds level subtotals when several levels are in scope", () => {
    const mixed: StatsSection[] = [...sections, { id: "p1", name: "U", grade_level: "1_grado", is_technical: false }];
    const stats = buildEnrollmentStats([...rows, row("p1", 6, "female", "CE", 4)], mixed, ALL);
    expect(stats.groupBlocks.map((b) => b.title)).toEqual([
      "Total Media General",
      "Total Media Técnica",
      "Total Primaria",
      "Total Secundaria",
    ]);
    expect(stats.groupBlocks.find((b) => b.key === "level:primary")!.bySex.total).toBe(4);
  });
});
