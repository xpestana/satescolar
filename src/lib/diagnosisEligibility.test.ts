import { describe, expect, it } from "vitest";
import { DiagnosisCandidate, diagnosisSectionKey, isDiagnosisGrade, pickDiagnosisAssignments } from "./diagnosisEligibility";

describe("isDiagnosisGrade", () => {
  it.each(["pre_maternal", "maternal", "i_nivel", "ii_nivel", "iii_nivel", "1_grado", "6_grado"])(
    "includes %s",
    (grade) => expect(isDiagnosisGrade(grade)).toBe(true),
  );

  it.each(["1_ano", "5_ano", "media_general", "media_tecnica", "", null, undefined])("excludes %j", (grade) => {
    expect(isDiagnosisGrade(grade)).toBe(false);
  });
});

const candidate = (assignmentId: string, overrides: Partial<DiagnosisCandidate> = {}): DiagnosisCandidate => ({
  assignmentId,
  sectionId: "sec1",
  schoolYearId: "y1",
  isMainReport: false,
  subjectName: assignmentId,
  displayOrder: null,
  ...overrides,
});

const pickedId = (candidates: DiagnosisCandidate[], sectionId = "sec1", yearId = "y1") =>
  pickDiagnosisAssignments(candidates).get(diagnosisSectionKey(sectionId, yearId))?.assignmentId;

describe("pickDiagnosisAssignments", () => {
  it("takes the main área when one is marked", () => {
    expect(pickedId([candidate("Arte", { displayOrder: 1 }), candidate("4to Grado", { isMainReport: true, displayOrder: 9 })]))
      .toBe("4to Grado");
  });

  it("without a main área takes the first by subject order, then by name", () => {
    expect(pickedId([candidate("Inglés"), candidate("Ed. Física", { displayOrder: 2 }), candidate("Arte", { displayOrder: 1 })]))
      .toBe("Arte");
    expect(pickedId([candidate("Inglés"), candidate("Computación")])).toBe("Computación");
  });

  it("picks one área per section and school year", () => {
    const picked = pickDiagnosisAssignments([
      candidate("a", { sectionId: "sec1", schoolYearId: "y1" }),
      candidate("b", { sectionId: "sec1", schoolYearId: "y2", isMainReport: true }),
      candidate("c", { sectionId: "sec1", schoolYearId: "y2" }),
      candidate("d", { sectionId: "sec2", schoolYearId: "y1" }),
    ]);
    expect([...picked.values()].map((c) => c.assignmentId).sort()).toEqual(["a", "b", "d"]);
  });

  it("is empty without candidates", () => {
    expect(pickDiagnosisAssignments([]).size).toBe(0);
  });
});
