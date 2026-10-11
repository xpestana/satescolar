import { describe, expect, it } from "vitest";
import {
  type CertificateEnrollmentRow,
  buildCertificateStudentList,
  filterCertificateStudents,
} from "./grade-certificate-students";

function row(overrides: Partial<CertificateEnrollmentRow>): CertificateEnrollmentRow {
  return {
    studentId: "st1",
    gradeLevel: "1_ano",
    sectionName: "A",
    yearRange: "2023-2024",
    documentId: "V30111222",
    status: "active",
    nameFields: { primer_nombre: "Corina", primer_apellido: "Márquez", segundo_apellido: "Subero" },
    ...overrides,
  };
}

describe("buildCertificateStudentList", () => {
  it("deja un estudiante por lista con su inscripción más reciente", () => {
    const list = buildCertificateStudentList([
      row({ gradeLevel: "2_ano", yearRange: "2024-2025", sectionName: "B" }),
      row({ gradeLevel: "1_ano", yearRange: "2023-2024" }),
      row({ gradeLevel: "3_ano", yearRange: "2025-2026", sectionName: "C" }),
    ], []);
    expect(list).toEqual([{
      studentId: "st1",
      name: "Márquez Subero Corina",
      documentId: "V30111222",
      status: "active",
      gradeLevel: "3_ano",
      sectionName: "C",
      yearRange: "2025-2026",
      hasCertificate: false,
    }]);
  });

  it("ignora inscripciones fuera de 1er–5to año", () => {
    const list = buildCertificateStudentList([
      row({ studentId: "primaria", gradeLevel: "6_grado" }),
      row({ studentId: "sexto", gradeLevel: "6_ano" }),
      row({ gradeLevel: "5_ano", yearRange: "2024-2025" }),
      row({ gradeLevel: "6_ano", yearRange: "2025-2026" }),
    ], []);
    expect(list.map((s) => [s.studentId, s.gradeLevel])).toEqual([["st1", "5_ano"]]);
  });

  it("ordena por apellidos y marca quién ya tiene certificación", () => {
    const list = buildCertificateStudentList([
      row({ studentId: "z", nameFields: { primer_nombre: "Ana", primer_apellido: "Zambrano" }, status: "graduated" }),
      row({ studentId: "a", nameFields: { primer_nombre: "Luis", primer_apellido: "Álvarez" }, documentId: null }),
    ], ["z"]);
    expect(list.map((s) => [s.name, s.hasCertificate, s.status, s.documentId])).toEqual([
      ["Álvarez Luis", false, "active", ""],
      ["Zambrano Ana", true, "graduated", "V30111222"],
    ]);
  });

  it("sin inscripciones devuelve una lista vacía", () => {
    expect(buildCertificateStudentList([], [])).toEqual([]);
  });
});

describe("filterCertificateStudents", () => {
  const list = buildCertificateStudentList([
    row({ studentId: "a", documentId: "V30111222" }),
    row({ studentId: "b", documentId: "V28999000", nameFields: { primer_nombre: "José", primer_apellido: "Peña" } }),
  ], []);

  it("sin búsqueda devuelve todos", () => {
    expect(filterCertificateStudents(list, "  ")).toBe(list);
  });

  it("busca por nombre sin importar acentos, mayúsculas ni orden", () => {
    expect(filterCertificateStudents(list, "marquez").map((s) => s.studentId)).toEqual(["a"]);
    expect(filterCertificateStudents(list, "CORINA márquez").map((s) => s.studentId)).toEqual(["a"]);
    expect(filterCertificateStudents(list, "pena jose").map((s) => s.studentId)).toEqual(["b"]);
  });

  it("busca por cédula", () => {
    expect(filterCertificateStudents(list, "28999").map((s) => s.studentId)).toEqual(["b"]);
    expect(filterCertificateStudents(list, "no existe")).toEqual([]);
  });
});
