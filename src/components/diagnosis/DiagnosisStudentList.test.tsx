import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { GradeStudent } from "@/hooks/useGradeStudents";

vi.mock("@/hooks/useStudentDiagnoses", () => ({
  useStudentDiagnoses: () => ({
    data: { st2: { student_id: "st2", strengths: "<p>Lee</p>", weaknesses: "", improvements: "", updated_at: "" } },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/usePdfPreview", () => ({
  usePdfPreview: () => ({ preview: null, openPreview: vi.fn(), closePreview: vi.fn() }),
}));
vi.mock("@/lib/diagnosisSheetData", () => ({ buildDiagnosisDocument: vi.fn() }));
// The editor pulls in the rich text editor and live preview; not under test here.
vi.mock("@/components/diagnosis/DiagnosisEditorModal", () => ({
  default: ({ students, index }: { students: GradeStudent[]; index: number }) => (
    <div data-testid="editor">{students[index].full_name}</div>
  ),
}));

import DiagnosisStudentList from "./DiagnosisStudentList";

const students: GradeStudent[] = [
  { student_id: "st1", student_name: "Álvarez Ana", full_name: "Ana Álvarez", document_id: "V-1" },
  { student_id: "st2", student_name: "Báez Luis", full_name: "Luis Báez", document_id: "V-2" },
  { student_id: "st3", student_name: "Castro Eva", full_name: "Eva Castro", document_id: null },
];

const renderList = (canEdit = true) =>
  render(
    <DiagnosisStudentList assignmentId="as1" schoolId="sc1" students={students} canEdit={canEdit} fileLabel="Lenguaje 1A" />,
  );

/** The desktop table (the phone cards repeat the same rows). */
const table = () => screen.getByRole("table");

describe("DiagnosisStudentList", () => {
  it("shows the progress and offers to download only the written diagnoses", () => {
    renderList();
    expect(screen.getByText("1 de 3 redactados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar todos \(1\)/ })).toBeEnabled();
  });

  it("filters pending and written students", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }));
    expect(within(table()).queryByText("Báez Luis")).not.toBeInTheDocument();
    expect(within(table()).getByText("Álvarez Ana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Redactados" }));
    expect(within(table()).getByText("Báez Luis")).toBeInTheDocument();
    expect(within(table()).queryByText("Álvarez Ana")).not.toBeInTheDocument();
  });

  it("disables the PDF of a student without diagnosis", () => {
    renderList();
    const rows = within(table()).getAllByRole("row");
    expect(within(rows[1]).getByRole("button", { name: /PDF/ })).toBeDisabled();
    expect(within(rows[2]).getByRole("button", { name: /PDF/ })).toBeEnabled();
  });

  it("opens the editor on the clicked student", () => {
    renderList();
    const rows = within(table()).getAllByRole("row");
    fireEvent.click(within(rows[3]).getByRole("button", { name: /Redactar/ }));
    expect(screen.getByTestId("editor")).toHaveTextContent("Eva Castro");
  });

  it("only views and downloads without edit permission", () => {
    renderList(false);
    expect(screen.queryByRole("button", { name: /Redactar|Editar/ })).not.toBeInTheDocument();
  });
});
