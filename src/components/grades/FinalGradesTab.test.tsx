import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * Primaria, Definitiva Final: lo escrito debe quedarse. Antes `assignmentIds` era un arreglo nuevo
 * en cada render y la carga inicial de primaria lo reseteaba todo sin parar.
 */

const reports = [1, 2, 3, 0].map((m) => ({
  student_id: "st1", assignment_id: "as1", momento: m, literal: "A", literal_numerico: 20,
  attendance_count: 0, absence_count: 0, final_status: null,
}));
const TABLES: Record<string, unknown> = {
  subject_teacher_assignments: [{ id: "as1", section_id: "sec1", teacher_id: "t1", section: { id: "sec1", grade_level: "1_grado" }, subject: { subject_type: "regular" } }],
  grades_config: [{ primary_report_type: "descriptive" }],
  primary_final_reports: reports,
  enrollments: [{ student_id: "st1", student: { document_id: "CE-1", form_data: { primer_nombre: "Ana", primer_apellido: "Perez" } } }],
  evaluation_plan_items: [], student_grades: [], final_grades: [], teacher_signatures: [], teachers: [],
};
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    let single = false;
    const c: Record<string | symbol, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") {
          const rows = (TABLES[table] as unknown[]) ?? [];
          const data = single ? rows[0] ?? null : rows;
          return (res: (v: unknown) => void) => res({ data, error: null });
        }
        if (prop === "single" || prop === "maybeSingle") single = true;
        return () => c;
      },
    });
    return c;
  };
  return { supabase: { from: (t: string) => chain(t), auth: { getUser: async () => ({ data: { user: null } }) } } };
});

import FinalGradesTab from "./FinalGradesTab";

describe("FinalGradesTab — definitiva de primaria", () => {
  it("conserva lo que se escribe en la definitiva y ajusta el literal", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <FinalGradesTab schoolId="sc1" effectiveYear="y1" selectedSubject="sub1" selectedSection="sec1"
            selectedGcrpAssignment="" selectedSubjectIsGcrp={false} sections={[]} gcrpAssignments={[]} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByPlaceholderText("Núm.")).toHaveLength(4));
    await waitFor(() => expect((screen.getAllByPlaceholderText("Núm.")[3] as HTMLInputElement).value).toBe("20"));
    const finalNum = screen.getAllByPlaceholderText("Núm.")[3] as HTMLInputElement;
    fireEvent.change(finalNum, { target: { value: "17" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect((screen.getAllByPlaceholderText("Núm.")[3] as HTMLInputElement).value).toBe("17");
    const literalInputs = screen.getAllByPlaceholderText("—") as HTMLInputElement[];
    expect(literalInputs[3].value).toBe("B");
    expect(screen.queryByText(/el promedio ya no coincide/)).toBeNull();

    // Cambiar un momento sí ofrece recalcular la definitiva.
    fireEvent.change(screen.getAllByPlaceholderText("Núm.")[0], { target: { value: "17" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.getByText(/el promedio ya no coincide/)).toBeTruthy();
  });
});
