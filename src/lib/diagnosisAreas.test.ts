import { describe, expect, it } from "vitest";
import { DiagnosisArea, defaultDiagnosisArea, orderDiagnosisAreas } from "./diagnosisAreas";
import { teacherDisplayName } from "./teacherName";

const area = (subjectName: string, overrides: Partial<DiagnosisArea> = {}): DiagnosisArea => ({
  assignmentId: subjectName,
  teacherId: "t",
  subjectName,
  teacherName: "",
  isMain: false,
  displayOrder: null,
  ...overrides,
});

describe("orderDiagnosisAreas", () => {
  it("puts the main área first, then by display order, then by name", () => {
    const ordered = orderDiagnosisAreas([
      area("Inglés"),
      area("Ed. Física", { displayOrder: 2 }),
      area("Arte", { displayOrder: 1 }),
      area("4to Grado", { isMain: true, displayOrder: 9 }),
      area("Computación"),
    ]);
    expect(ordered.map((a) => a.subjectName)).toEqual(["4to Grado", "Arte", "Ed. Física", "Computación", "Inglés"]);
  });

  it("does not mutate the input", () => {
    const input = [area("B"), area("A")];
    orderDiagnosisAreas(input);
    expect(input.map((a) => a.subjectName)).toEqual(["B", "A"]);
  });
});

describe("defaultDiagnosisArea", () => {
  it("picks the main área, or the first one, or null", () => {
    expect(defaultDiagnosisArea([area("Inglés"), area("4to Grado", { isMain: true })])?.subjectName).toBe("4to Grado");
    expect(defaultDiagnosisArea([area("Inglés"), area("Arte")])?.subjectName).toBe("Arte");
    expect(defaultDiagnosisArea([])).toBeNull();
  });
});

describe("teacherDisplayName", () => {
  it("reads either naming of the teacher form", () => {
    expect(teacherDisplayName({ nombre: "Ana", apellido: "Pérez" })).toBe("Ana Pérez");
    expect(teacherDisplayName({ primer_nombre: "Luis", primer_apellido: "Báez" })).toBe("Luis Báez");
    expect(teacherDisplayName(null)).toBe("");
  });
});
