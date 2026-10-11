import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Flujo completo de la pestaña con datos simulados: elegir estudiante, ver las áreas por defecto,
 * escribir una nota, sincronizar con la definitiva final y guardar.
 */

const SUBJECT = { display_order: 1, show_in_planilla: true, evaluation_type: "numeric", subject_type: "regular", is_suspended: false };
const TABLES: Record<string, unknown[]> = {
  enrollments: [{
    id: "e1", student_id: "st1", section_id: "sec1", school_year_id: "y1",
    sections: { grade_level: "1_ano", name: "A" },
    school_years: { year_range: "2024 - 2025" },
    student: { document_id: "V30111222", status: "graduated", primer_nombre: "Corina", primer_apellido: "Márquez" },
  }],
  grade_certificates: [],
  planilla_general_config: [{
    id: "cfg1", school_id: "sc1",
    school_header: { nombre_plantel: "U.E. Demo", municipio_plantel: "Maturín", entidad_federal: "Monagas" },
    grade_certificate_config: {},
  }],
  states: [{ name: "Monagas", acronym: "MO" }],
  students: [{ document_id: "V30111222", form_data: { primer_nombre: "Corina", primer_apellido: "Márquez", fecha_nacimiento: "2012-07-18" } }],
  subject_teacher_assignments: [
    { id: "a1", subject_id: "s-cas", section_id: "sec1", school_year_id: "y1", school_subjects: { ...SUBJECT, name: "Castellano" } },
    { id: "a2", subject_id: "s-fis", section_id: "sec1", school_year_id: "y1", school_subjects: { ...SUBJECT, name: "Física", display_order: 2 } },
  ],
  gcrp_assignment_students: [],
  final_grades: [
    { assignment_id: "a1", grade_value: "13.6", adjustment_points: 0 },
    { assignment_id: "a2", grade_value: "18", adjustment_points: 0 },
  ],
};
const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];

const downloads: Array<{ blob: Blob; filename: string }> = [];

vi.mock("@/hooks/useSchoolId", () => ({ useSchoolId: () => ({ schoolId: "sc1", isLoading: false }) }));
vi.mock("@/lib/resumen-final-docx", () => ({
  downloadBlob: (blob: Blob, filename: string) => { downloads.push({ blob, filename }); },
}));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    let single = false;
    const c: Record<string | symbol, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") {
          const rows = TABLES[table] ?? [];
          const data = single ? rows[0] ?? null : rows;
          return (res: (v: unknown) => void) => res({ data, error: null });
        }
        if (prop === "single" || prop === "maybeSingle") single = true;
        if (prop === "upsert") return (payload: Record<string, unknown>) => { upserts.push({ table, payload }); return c; };
        return () => c;
      },
    });
    return c;
  };
  return { supabase: { from: (t: string) => chain(t) } };
});

import { GradeCertificateTab } from "./GradeCertificateTab";

beforeAll(() => {
  // Radix (checkbox, dialog) measures elements; jsdom has no ResizeObserver.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  // The header logo is fetched as an asset; without it the Word falls back to the ministry's name.
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
});

const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("GradeCertificateTab", () => {
  it("permite armar, sincronizar y guardar la certificación de un egresado", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <GradeCertificateTab />
      </QueryClientProvider>,
    );

    // El egresado aparece en la lista y se abre su certificación.
    const student = await screen.findByText("Márquez Corina");
    expect(screen.getByText("Egresado")).toBeInTheDocument();
    fireEvent.click(student);

    // Año sin notas: las 7 áreas por defecto, nada pendiente de guardar.
    await waitFor(() => expect(screen.getAllByLabelText(/^Área de formación \d+$/)).toHaveLength(7));
    expect(input("Área de formación 1").value).toBe("CASTELLANO");
    expect(screen.getByText("Todo guardado")).toBeInTheDocument();
    expect(await screen.findByText("18 DE JULIO 2012")).toBeInTheDocument();

    // Escribir una nota: cero delante, en letras, T-E por defecto y aviso de cambios.
    const grade = input("Nota de CASTELLANO");
    fireEvent.change(grade, { target: { value: "9" } });
    fireEvent.blur(input("Nota de CASTELLANO"));
    expect(input("Nota de CASTELLANO").value).toBe("09");
    expect(screen.getByText("NUEVE")).toBeInTheDocument();
    expect((screen.getAllByLabelText("Tipo de evaluación")[0] as HTMLInputElement).value).toBe("F");
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();

    // Sincronizar: Castellano coincide por nombre (actualiza) y Física es nueva.
    fireEvent.click(screen.getByRole("button", { name: /Sincronizar notas/ }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Actualiza");
    expect(within(dialog).getByText("Nueva")).toBeInTheDocument();
    expect(within(dialog).getByText(/1er Año/)).toBeInTheDocument();
    // Solo se trae Castellano: se desmarca Física.
    fireEvent.click(within(dialog).getByLabelText(/FÍSICA/));
    fireEvent.click(within(dialog).getByRole("button", { name: /Traer 1 elemento/ }));

    await waitFor(() => expect(input("Nota de CASTELLANO").value).toBe("14"));
    expect(screen.getByText("CATORCE")).toBeInTheDocument();
    expect((screen.getAllByLabelText("Mes")[0] as HTMLInputElement).value).toBe("07");
    expect((screen.getAllByLabelText("Año")[0] as HTMLInputElement).value).toBe("2025");
    // Las otras 6 áreas por defecto siguen ahí y no se agregó Física.
    expect(screen.getAllByLabelText(/^Área de formación \d+$/)).toHaveLength(7);
    // El plantel se creó solo con los Datos comunes y quedó asignado a la nota.
    expect(input("Denominación de la institución 1").value).toBe("U.E. DEMO");
    expect(input("Entidad federal de la institución 1").value).toBe("MO");
    expect(screen.getByText("Mi plantel")).toBeInTheDocument();
    expect(screen.getAllByText("N° 1").length).toBeGreaterThan(0);

    // Con cambios pendientes no se puede descargar: el Word imprime lo guardado.
    expect(screen.getByRole("button", { name: /Descargar Word/ })).toBeDisabled();

    // Guardar envía el documento completo.
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(upserts).toHaveLength(1));
    const { table, payload } = upserts[0];
    expect(table).toBe("grade_certificates");
    expect(payload).toMatchObject({ school_id: "sc1", student_id: "st1", observations: "", issue_date: null });
    const institutions = payload.institutions as Array<Record<string, unknown>>;
    const years = payload.year_records as Array<{ yearLevel: number; grades: Array<Record<string, unknown>> }>;
    expect(institutions).toHaveLength(1);
    expect(institutions[0]).toMatchObject({ name: "U.E. DEMO", locality: "MATURÍN", federalEntity: "MO", isOwnSchool: true });
    expect(years.map((y) => y.yearLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(years[0].grades).toHaveLength(7);
    expect(years[0].grades[0]).toMatchObject({
      subjectName: "CASTELLANO", grade: "14", evaluationType: "F", month: "07", year: "2025",
      institutionId: institutions[0].id, sourceSubjectId: "s-cas",
    });
    await waitFor(() => expect(screen.getByText("Todo guardado")).toBeInTheDocument());

    // Ya guardado, descarga el Word con el nombre del estudiante.
    fireEvent.click(screen.getByRole("button", { name: /Descargar Word/ }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].filename).toBe("Certificacion_de_Notas_MARQUEZ_CORINA_V30111222.docx");
    expect(downloads[0].blob.size).toBeGreaterThan(5000);
    // A whole flow with dialogs and a generated document: give it room when the suite runs in parallel.
  }, 20_000);
});
