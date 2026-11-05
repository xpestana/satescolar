import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GradeStudent } from "@/hooks/useGradeStudents";
import { ReportCardEntryDialog, type ReportCardEntry } from "./ReportCardEntryDialog";

const students: GradeStudent[] = [
  { student_id: "st1", student_name: "Álvarez Ana", full_name: "Ana Álvarez", document_id: "V-1" },
  { student_id: "st2", student_name: "Báez Luis", full_name: "Luis Báez", document_id: "V-2" },
];

const STATUS = [{ value: "aprobado", label: "Aprobado" }];
const saved: Record<string, ReportCardEntry> = {
  st1: { literal: "B", attendance_count: 40, absence_count: 2, final_status: "aprobado" },
};
const savedEntry = (id: string): ReportCardEntry =>
  saved[id] ?? { literal: "", attendance_count: 0, absence_count: 0, final_status: "" };

function Harness({
  onSave,
  onOpenReport = vi.fn(),
}: {
  onSave: (studentId: string, entry: ReportCardEntry) => Promise<void>;
  onOpenReport?: (s: GradeStudent) => void;
}) {
  const [index, setIndex] = useState<number | null>(0);
  return (
    <>
      <span data-testid="index">{String(index)}</span>
      <ReportCardEntryDialog
        students={students}
        index={index}
        onIndexChange={setIndex}
        momento={1}
        levelLabel="Primaria"
        statusOptions={STATUS}
        savedEntry={savedEntry}
        hasReport={(id) => id === "st1"}
        onSave={onSave}
        onOpenReport={onOpenReport}
      />
    </>
  );
}

describe("ReportCardEntryDialog", () => {
  it("starts from the saved literal and attendance", () => {
    render(<Harness onSave={vi.fn()} />);
    expect(screen.getByText("Ana Álvarez")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "B" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Asistencias")).toHaveValue(40);
    expect(screen.getByLabelText("Inasistencias")).toHaveValue(2);
    expect(screen.getByRole("button", { name: /Editar informe descriptivo/ })).toBeInTheDocument();
  });

  it("saves the whole entry and moves to the next student", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    fireEvent.change(screen.getByLabelText("Inasistencias"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar y siguiente/ }));
    await waitFor(() => expect(screen.getByTestId("index")).toHaveTextContent("1"));
    expect(onSave).toHaveBeenCalledWith("st1", {
      literal: "A", attendance_count: 40, absence_count: 3, final_status: "aprobado",
    });
    expect(screen.getByRole("button", { name: /Redactar informe descriptivo/ })).toBeInTheDocument();
  });

  it("saves pending changes before opening the descriptive report", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenReport = vi.fn();
    render(<Harness onSave={onSave} onOpenReport={onOpenReport} />);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    fireEvent.click(screen.getByRole("button", { name: /Editar informe descriptivo/ }));
    await waitFor(() => expect(onOpenReport).toHaveBeenCalledWith(students[0]));
    expect(onSave).toHaveBeenCalledWith("st1", expect.objectContaining({ literal: "" }));
    expect(screen.getByTestId("index")).toHaveTextContent("null");
  });
});
