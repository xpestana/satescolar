import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GradeStudent } from "@/hooks/useGradeStudents";
import type { GradeChange } from "@/lib/gradeEntry";
import { StudentGradesDialog, type GradePlanItem } from "./StudentGradesDialog";

const students: GradeStudent[] = [
  { student_id: "st1", student_name: "Álvarez Ana", full_name: "Ana Álvarez", document_id: "V-1" },
  { student_id: "st2", student_name: "Báez Luis", full_name: "Luis Báez", document_id: null },
];

const planItems: GradePlanItem[] = [
  { id: "p1", description: "Prueba corta", percentage: 30 },
  { id: "p2", description: "Exposición", percentage: 70 },
];

function Harness({
  numeric,
  onSave,
  grades = { "st1-p1": "15" },
  startIndex = 0,
}: {
  numeric: boolean;
  onSave: (studentId: string, changes: GradeChange[]) => Promise<void>;
  grades?: Record<string, string>;
  startIndex?: number | null;
}) {
  const [index, setIndex] = useState<number | null>(startIndex);
  return (
    <>
      <span data-testid="index">{String(index)}</span>
      <StudentGradesDialog
        students={students}
        index={index}
        onIndexChange={setIndex}
        planItems={planItems}
        grades={grades}
        numeric={numeric}
        momento={2}
        onSave={onSave}
      />
    </>
  );
}

describe("StudentGradesDialog", () => {
  it("shows the student, cédula, momento and the saved grades", () => {
    render(<Harness numeric onSave={vi.fn()} />);
    expect(screen.getByText("Ana Álvarez")).toBeInTheDocument();
    expect(screen.getByText("C.I. V-1")).toBeInTheDocument();
    expect(screen.getByText("Momento 2")).toBeInTheDocument();
    expect(screen.getByLabelText(/Prueba corta/)).toHaveValue(15);
    expect(screen.getByLabelText(/Exposición/)).toHaveValue(null);
    expect(screen.getByText(/1 de 2 cargadas/)).toBeInTheDocument();
  });

  it("ignores numeric values outside 1–20", () => {
    render(<Harness numeric onSave={vi.fn()} />);
    const field = screen.getByLabelText(/Exposición/);
    fireEvent.change(field, { target: { value: "25" } });
    expect(field).toHaveValue(null);
    fireEvent.change(field, { target: { value: "18" } });
    expect(field).toHaveValue(18);
  });

  it("saves only the changed grades and moves to the next student", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness numeric onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Exposición/), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar y siguiente/ }));
    await waitFor(() => expect(screen.getByTestId("index")).toHaveTextContent("1"));
    expect(onSave).toHaveBeenCalledWith("st1", [{ planItemId: "p2", value: "18" }]);
    expect(screen.getByText("Luis Báez")).toBeInTheDocument();
  });

  it("closes without saving when nothing changed", async () => {
    const onSave = vi.fn();
    render(<Harness numeric onSave={onSave} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar" })[0]);
    await waitFor(() => expect(screen.getByTestId("index")).toHaveTextContent("null"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("stays open when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    render(<Harness numeric onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Exposición/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByTestId("index")).toHaveTextContent("0");
  });

  it("uses free text fields for primary and preschool", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness numeric={false} onSave={onSave} grades={{}} startIndex={1} />);
    const field = screen.getByLabelText(/Prueba corta/);
    expect(field.tagName).toBe("TEXTAREA");
    fireEvent.change(field, { target: { value: "Logró identificar las vocales" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar y terminar/ }));
    await waitFor(() => expect(screen.getByTestId("index")).toHaveTextContent("null"));
    expect(onSave).toHaveBeenCalledWith("st2", [{ planItemId: "p1", value: "Logró identificar las vocales" }]);
  });
});
