import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SectionDiagnosisAssignment } from "@/hooks/useSectionDiagnosisAssignments";
import { diagnosisSectionKey } from "@/lib/diagnosisEligibility";

let picked = new Map<string, SectionDiagnosisAssignment>();

vi.mock("@/hooks/useSectionDiagnosisAssignments", () => ({
  useSectionDiagnosisAssignments: () => ({ data: picked, isLoading: false }),
}));
vi.mock("@/hooks/useGradeStudents", () => ({
  useGradeStudents: () => ({ data: [], isLoading: false }),
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

const area = (overrides: Partial<SectionDiagnosisAssignment> = {}): SectionDiagnosisAssignment => ({
  assignmentId: "as1",
  sectionId: "sec1",
  schoolYearId: "y1",
  isMainReport: true,
  subjectName: "4to Grado",
  displayOrder: 1,
  teacherId: "t1",
  teacherName: "Ana Pérez",
  ...overrides,
});

const renderTab = (canEdit = true) =>
  render(<DiagnosisTab schoolId="sc1" schoolYearId="y1" sectionId="sec1" sectionLabel="4to Grado - Sección U" canEdit={canEdit} />);

describe("DiagnosisTab", () => {
  it("works on the área that carries the diagnosis and its teacher", () => {
    picked = new Map([[diagnosisSectionKey("sec1", "y1"), area()]]);
    renderTab();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByTestId("list")).toHaveTextContent("as1:edit");
    expect(screen.getByTestId("signature")).toHaveTextContent("t1");
    expect(screen.queryByText(/Ninguna área/)).not.toBeInTheDocument();
  });

  it("says so when no área is marked as main and the first one is used", () => {
    picked = new Map([[diagnosisSectionKey("sec1", "y1"), area({ isMainReport: false })]]);
    renderTab(false);
    expect(screen.getByText(/Ninguna área de la sección está marcada como principal/)).toBeInTheDocument();
    expect(screen.getByTestId("list")).toHaveTextContent("as1:view");
  });

  it("only takes the selected school year", () => {
    picked = new Map([[diagnosisSectionKey("sec1", "other-year"), area()]]);
    renderTab();
    expect(screen.getByText(/no tiene áreas asignadas/)).toBeInTheDocument();
    expect(screen.queryByTestId("list")).not.toBeInTheDocument();
  });
});
