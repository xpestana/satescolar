import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DiagnosisArea } from "@/lib/diagnosisAreas";

let areas: DiagnosisArea[] = [];

vi.mock("@/hooks/useSectionDiagnosisAreas", () => ({
  useSectionDiagnosisAreas: () => ({ data: areas, isLoading: false }),
}));
vi.mock("@/hooks/useDiagnosisCounts", () => ({
  useDiagnosisCounts: () => ({ data: { as1: 2, as2: 0 } }),
}));
vi.mock("@/hooks/useGradeStudents", () => ({
  useGradeStudents: () => ({
    data: [
      { student_id: "st1", student_name: "A", full_name: "A", document_id: null },
      { student_id: "st2", student_name: "B", full_name: "B", document_id: null },
      { student_id: "st3", student_name: "C", full_name: "C", document_id: null },
    ],
    isLoading: false,
  }),
}));
vi.mock("@/components/grades/TeacherSignatureCard", () => ({
  default: ({ teacherId }: { teacherId: string }) => <div data-testid="signature">{teacherId}</div>,
}));
vi.mock("@/components/diagnosis/DiagnosisStudentList", () => ({
  default: ({ assignmentId, canEdit }: { assignmentId: string; canEdit: boolean }) => (
    <div data-testid="list">{assignmentId}:{canEdit ? "edit" : "view"}</div>
  ),
}));

import DiagnosisTab from "./DiagnosisTab";

const renderTab = () =>
  render(<DiagnosisTab schoolId="sc1" schoolYearId="y1" sectionId="sec1" sectionLabel="4to Grado - Sección U" canEdit />);

describe("DiagnosisTab", () => {
  it("starts on the main área and shows how many diagnoses each área has", () => {
    areas = [
      { assignmentId: "as1", teacherId: "t1", subjectName: "4to Grado", teacherName: "Ana Pérez", isMain: true, displayOrder: 1 },
      { assignmentId: "as2", teacherId: "t2", subjectName: "Inglés", teacherName: "Luis Ruiz", isMain: false, displayOrder: 2 },
    ];
    renderTab();
    expect(screen.getByTestId("list")).toHaveTextContent("as1:edit");
    expect(screen.getByTestId("signature")).toHaveTextContent("t1");
    expect(screen.getByText("Ana Pérez · 2/3")).toBeInTheDocument();
    expect(screen.getByText("Luis Ruiz · 0/3")).toBeInTheDocument();
  });

  it("switches to another área of the section", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Inglés/ }));
    expect(screen.getByTestId("list")).toHaveTextContent("as2:edit");
    expect(screen.getByTestId("signature")).toHaveTextContent("t2");
  });

  it("explains what to do when the section has no áreas", () => {
    areas = [];
    renderTab();
    expect(screen.getByText(/no tiene áreas asignadas/)).toBeInTheDocument();
    expect(screen.queryByTestId("list")).not.toBeInTheDocument();
  });
});
