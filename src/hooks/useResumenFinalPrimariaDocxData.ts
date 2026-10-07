import { supabase } from "@/integrations/supabase/client";
import {
  buildGeoCacheFromFormData,
  buildStateAcronymCacheFromFormData,
} from "@/lib/geo-resolve";
import { formatPlanillaStudentNameParts, formatPlanillaStudentText } from "@/lib/resumen-final-text";
import { DEFAULT_PRIMARY_COD, PRIMARY_ROWS_PER_PART } from "@/lib/resumen-final-level";
import {
  countPrimariaLiterals,
  formatPrimariaCedula,
  pickPrimariaFinalResults,
  type PrimariaFinalReport,
  type PrimariaFinalResult,
  type PrimariaLiteral,
  type PrimariaLiteralTotals,
} from "@/lib/resumen-final-primaria";
import {
  birthDateParts,
  entidadFederalFromForm,
  lugarNacimientoFromForm,
  teacherName,
} from "@/hooks/useResumenFinalDocxData";

export interface PrimariaStudentRow {
  nro: number;
  cedula: string;
  apellidos: string;
  nombres: string;
  lugarNacimiento: string;
  entidadFederal: string;
  sexo: string;
  diaNac: string;
  mesNac: string;
  anioNac: string;
  /** Literal de la definitiva final (momento 0); "" si no tiene. */
  literal: PrimariaLiteral | "";
  /** Nota numérica de la definitiva final (casilla P.), entera; "" si no tiene. */
  nota: string;
}

export interface ResumenFinalPrimariaDocxData {
  schoolHeader: Record<string, string>;
  yearRange: string;
  sectionGradeLevel: string;
  sectionName: string;
  parte: number;
  totalStudentsInSection: number;
  studentsInPage: number;
  /** Código (COD) de la planilla; por defecto 21000. */
  cod: string;
  observaciones: string;
  nombreProfesor: string;
  cedulaProfesor: string;
  students: PrimariaStudentRow[];
  literalTotals: PrimariaLiteralTotals;
}

type AssignmentRow = {
  id: string;
  is_main_report: boolean | null;
  teacher: { document_id: string | null; form_data: Record<string, unknown> | null } | null;
};

export async function fetchResumenFinalPrimariaDocxData(
  schoolId: string,
  schoolYearId: string,
  sectionId: string,
  parte: number,
): Promise<ResumenFinalPrimariaDocxData> {
  if (!schoolId || !schoolYearId || !sectionId) throw new Error("Missing params");

  const [{ data: yearData }, { data: planillaConfig }, { data: section }, { data: sectionConfigs }] =
    await Promise.all([
      supabase.from("school_years").select("year_range").eq("id", schoolYearId).single(),
      supabase.from("planilla_general_config").select("school_header").eq("school_id", schoolId).maybeSingle(),
      supabase.from("sections").select("grade_level, name").eq("id", sectionId).single(),
      supabase
        .from("resumen_final_config")
        .select("parte, tipo_planilla, observaciones, nombre_profesor, cedula_profesor")
        .eq("school_id", schoolId)
        .eq("school_year_id", schoolYearId)
        .eq("section_id", sectionId)
        .order("parte"),
    ]);
  // Observaciones son de cada parte; COD y docente se comparten en toda la sección.
  const configs = sectionConfigs ?? [];
  const rfConfig = configs.find((c) => c.parte === parte);
  // Valor compartido: el de esta parte o, si está vacío, el de la primera parte que lo tenga.
  const shared = (field: "tipo_planilla" | "nombre_profesor" | "cedula_profesor") =>
    [rfConfig, ...configs].map((c) => c?.[field]?.trim()).find(Boolean) ?? "";
  const schoolHeader = (planillaConfig?.school_header as Record<string, string>) ?? {};

  // Estudiantes ordenados por cédula (menor a mayor), igual que bachillerato.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId);
  const enrolledIds = (enrollments ?? []).map((e) => e.student_id);
  if (enrolledIds.length === 0) throw new Error("No hay estudiantes inscritos en esta sección");

  const { data: students } = await supabase
    .from("students")
    .select("id, document_id, form_data")
    .in("id", enrolledIds);
  const sorted = [...(students ?? [])].sort((a, b) =>
    (a.document_id ?? "").localeCompare(b.document_id ?? "", undefined, { numeric: true }),
  );
  const start = (parte - 1) * PRIMARY_ROWS_PER_PART;
  const pageStudents = sorted.slice(start, start + PRIMARY_ROWS_PER_PART);
  if (pageStudents.length === 0) throw new Error("No hay estudiantes en esta parte");
  const pageIds = pageStudents.map((s) => s.id);

  // Literal y nota de la definitiva final: primary_final_reports, momento 0. Se guardan en una sola
  // asignación de la sección (no necesariamente la principal), así que se busca en todas.
  const { data: assignmentsData } = await supabase
    .from("subject_teacher_assignments")
    .select("id, is_main_report, teacher:teacher_id(document_id, form_data)")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId)
    .eq("is_suspended", false);
  const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];
  const assignmentIds = assignments.map((a) => a.id);

  let finalByStudent = new Map<string, PrimariaFinalResult>();
  if (assignmentIds.length > 0) {
    const { data: reports, error } = await supabase
      .from("primary_final_reports")
      .select("student_id, literal, literal_numerico")
      .eq("momento", 0)
      .in("assignment_id", assignmentIds)
      .in("student_id", pageIds);
    if (error) throw new Error(`Error al cargar literales finales: ${error.message}`);
    finalByStudent = pickPrimariaFinalResults((reports ?? []) as PrimariaFinalReport[]);
  }

  const formDataList = pageStudents
    .map((s) => (s.form_data || {}) as Record<string, unknown>)
    .filter((fd) => Object.keys(fd).length > 0);
  const [geoCache, stateAcronymCache] = await Promise.all([
    buildGeoCacheFromFormData(formDataList),
    buildStateAcronymCacheFromFormData(formDataList),
  ]);

  const rows: PrimariaStudentRow[] = pageStudents.map((s, idx) => {
    const fd = (s.form_data || {}) as Record<string, unknown>;
    return {
      nro: idx + 1,
      cedula: formatPrimariaCedula(s.document_id),
      apellidos: formatPlanillaStudentNameParts([fd.primer_apellido, fd.segundo_apellido], true),
      nombres: formatPlanillaStudentNameParts([fd.primer_nombre, fd.segundo_nombre], true),
      lugarNacimiento: formatPlanillaStudentText(lugarNacimientoFromForm(fd, geoCache), true),
      entidadFederal: entidadFederalFromForm(fd, geoCache, stateAcronymCache),
      sexo: String(fd.sexo || fd.genero || "").toUpperCase().substring(0, 1),
      ...birthDateParts(fd),
      literal: finalByStudent.get(s.id)?.literal ?? "",
      nota: finalByStudent.get(s.id)?.nota ?? "",
    };
  });

  // Docente: la configurada en cualquier parte de la sección; si no hay, la de la asignación principal.
  const mainTeacher = (assignments.find((a) => a.is_main_report) ?? assignments[0])?.teacher;
  return {
    schoolHeader,
    yearRange: yearData?.year_range || "",
    sectionGradeLevel: section?.grade_level || "",
    sectionName: section?.name || "",
    parte,
    totalStudentsInSection: sorted.length,
    studentsInPage: rows.length,
    cod: shared("tipo_planilla") || DEFAULT_PRIMARY_COD,
    observaciones: rfConfig?.observaciones || "",
    nombreProfesor: shared("nombre_profesor") || teacherName(mainTeacher?.form_data),
    cedulaProfesor: shared("cedula_profesor") || formatPrimariaCedula(mainTeacher?.document_id),
    students: rows,
    literalTotals: countPrimariaLiterals(rows.map((r) => r.literal)),
  };
}
