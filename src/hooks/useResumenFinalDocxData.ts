import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";

export interface SubjectCol {
  id: string;
  name: string;
  abbreviation: string;
  evaluationType: string;
  isGcrp: boolean;
  assignmentId: string;
  teacherName: string;
  teacherCedula: string;
}

export interface StudentDocxRow {
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
  grades: Record<string, string>; // assignmentId → display value (regular + productive)
  gpGrade: string;
  grupoName: string;
}

export interface ResumenFinalDocxData {
  // school
  schoolHeader: Record<string, string>;
  yearRange: string;
  // section
  sectionGradeLevel: string;
  sectionName: string;
  parte: number;
  totalStudentsInSection: number;
  studentsInPage: number;
  // subjects
  regularSubjects: SubjectCol[];
  productiveSubjects: SubjectCol[];
  // students (sliced for this parte, max 35)
  students: StudentDocxRow[];
  // config
  tipoPlanilla: "31059" | "31060";
  planEstudio: string;
  observaciones: string;
  nombreProfesor: string;
  cedulaProfesor: string;
  /** Totales por materia (key = assignmentId) para el pie "Total de Áreas de Formación". */
  subjectTotals: Record<string, SubjectAreaTotals>;
}

export interface SubjectAreaTotals {
  inscritos: number;
  inasistentes: number;
  asistentes: number;
  aprobados: number;
  noAprobados: number;
  noCursantes: number;
}

import { computeSubjectAreaTotals } from "@/lib/resumen-final-subject-totals";
import { computeGpGradeAndGrupo } from "@/lib/resumen-final-gcrp";
import { resolvePlanEstudio } from "@/lib/resumen-final-plan-estudio";
import { formatResumenFinalGrade } from "@/lib/gradeLiteral";

function gradeDisplay(
  gradeValue: string | null,
  adjPoints: number,
  evalType: string,
  _finalStatus: string | null,
): string {
  return formatResumenFinalGrade(gradeValue, adjPoints, evalType);
}

type GradeRecord = {
  student_id: string;
  assignment_id: string;
  grade_value: string | null;
  adjustment_points: number;
  final_status: string | null;
  absence_count: number | null;
  attendance_count: number | null;
};

function teacherName(fd: Record<string, any> | null): string {
  if (!fd) return "";
  return `${fd.primer_apellido || fd.apellido || ""} ${fd.segundo_apellido || ""} ${fd.primer_nombre || fd.nombre || ""} ${fd.segundo_nombre || ""}`.replace(/\s+/g, " ").trim().toUpperCase();
}

type AssignmentWithSubject = {
  id: string;
  subject_id: string;
  teacher: unknown;
  school_subjects: {
    id: string;
    name: string;
    abbreviation: string;
    display_order: number;
    show_in_planilla: boolean;
    evaluation_type: string;
    subject_type: string;
    is_suspended: boolean;
  } | null;
};

function isRegularPlanillaAssignment(a: AssignmentWithSubject): boolean {
  const s = a.school_subjects;
  if (!s) return false;
  if (s.is_suspended) return false;
  if (s.subject_type !== "regular") return false;
  if (s.show_in_planilla === false) return false;
  return true;
}

function isProductivePlanillaAssignment(a: AssignmentWithSubject): boolean {
  const s = a.school_subjects;
  if (!s) return false;
  if (s.is_suspended) return false;
  if (s.subject_type === "regular") return false;
  if (s.subject_type === "gcrp") return false;
  if (s.show_in_planilla === false) return false;
  return true;
}

/** Productivas de planilla 31060: incluye GCRP como columna productiva (sin GP/GRUPO). */
function isMergedProductivePlanillaAssignment(a: AssignmentWithSubject): boolean {
  const s = a.school_subjects;
  if (!s) return false;
  if (s.is_suspended) return false;
  if (s.subject_type === "regular") return false;
  if (s.show_in_planilla === false) return false;
  return true;
}

function isGcrpPlanillaAssignment(a: AssignmentWithSubject): boolean {
  const s = a.school_subjects;
  if (!s) return false;
  if (s.is_suspended) return false;
  if (s.subject_type !== "gcrp") return false;
  if (s.show_in_planilla === false) return false;
  return true;
}

function dedupeAssignmentsBySubject(assignments: AssignmentWithSubject[]): AssignmentWithSubject[] {
  const bySubject = new Map<string, AssignmentWithSubject>();
  for (const a of assignments) {
    const existing = bySubject.get(a.subject_id);
    if (!existing) {
      bySubject.set(a.subject_id, a);
      continue;
    }
    const orderA = a.school_subjects?.display_order ?? 999;
    const orderB = existing.school_subjects?.display_order ?? 999;
    if (orderA < orderB) bySubject.set(a.subject_id, a);
  }
  return Array.from(bySubject.values()).sort(
    (a, b) => (a.school_subjects?.display_order ?? 999) - (b.school_subjects?.display_order ?? 999),
  );
}

async function fetchRegularAssignmentsForSection(
  schoolId: string,
  schoolYearId: string,
  sectionId: string,
): Promise<AssignmentWithSubject[]> {
  const { data, error } = await supabase
    .from("subject_teacher_assignments")
    .select("id, subject_id, teacher:teacher_id(id, document_id, form_data), school_subjects(id, name, abbreviation, display_order, show_in_planilla, evaluation_type, subject_type, is_suspended)")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId)
    .eq("is_suspended", false);

  if (error) throw new Error(`Error al cargar materias de la sección: ${error.message}`);

  return dedupeAssignmentsBySubject(
    ((data ?? []) as AssignmentWithSubject[]).filter(isRegularPlanillaAssignment),
  );
}

export async function fetchResumenFinalSubjectsPreview(
  schoolId: string,
  schoolYearId: string,
  sectionId: string,
): Promise<{ abbreviations: string[]; count: number; productiveAbbreviations: string[] }> {
  const [regularAssignments, productiveData] = await Promise.all([
    fetchRegularAssignmentsForSection(schoolId, schoolYearId, sectionId),
    supabase
      .from("subject_teacher_assignments")
      .select("id, subject_id, school_subjects(id, name, abbreviation, display_order, show_in_planilla, subject_type, is_suspended)")
      .eq("school_id", schoolId)
      .eq("school_year_id", schoolYearId)
      .eq("section_id", sectionId)
      .eq("is_suspended", false),
  ]);

  const abbreviations = regularAssignments.map((a) => {
    const s = a.school_subjects!;
    return (s.abbreviation || s.name.substring(0, 2)).toUpperCase();
  });

  const productiveAssignments = dedupeAssignmentsBySubject(
    ((productiveData.data ?? []) as AssignmentWithSubject[]).filter(isProductivePlanillaAssignment),
  );
  const productiveAbbreviations = productiveAssignments.map((a) => {
    const s = a.school_subjects!;
    return (s.abbreviation || s.name.substring(0, 2)).toUpperCase();
  });

  return { abbreviations, count: abbreviations.length, productiveAbbreviations };
}

export async function fetchResumenFinalSubjectsForEditor(
  schoolId: string,
  schoolYearId: string,
  sectionId: string,
): Promise<Array<{ id: string; name: string; abbreviation: string }>> {
  const assignments = await fetchRegularAssignmentsForSection(schoolId, schoolYearId, sectionId);
  return assignments.map((a) => {
    const s = a.school_subjects!;
    return {
      id: s.id,
      name: s.name,
      abbreviation: s.abbreviation || s.name.substring(0, 2).toUpperCase(),
    };
  });
}

const CALC_PARTS = (count: number) => Math.max(1, Math.ceil(count / 35));

const GEO_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const GEO_FIELD_NAMES = [
  "estado_nacimiento",
  "municipio_nacimiento",
  "ciudad_nacimiento",
  "parroquia_nacimiento",
  "estado",
  "municipio",
  "ciudad",
  "parroquia",
  "lugar_nacimiento",
];

function resolveGeoName(
  value: string | undefined | null,
  geoCache: Record<string, string>,
): string {
  if (!value) return "";
  const v = String(value).trim();
  if (GEO_UUID_PATTERN.test(v)) return geoCache[v] || "";
  return v;
}

async function buildGeoCache(
  formDataList: Record<string, unknown>[],
): Promise<Record<string, string>> {
  const uuids = new Set<string>();
  for (const fd of formDataList) {
    for (const key of GEO_FIELD_NAMES) {
      const val = fd[key];
      if (typeof val === "string" && GEO_UUID_PATTERN.test(val)) uuids.add(val);
    }
    for (const val of Object.values(fd)) {
      if (typeof val === "string" && GEO_UUID_PATTERN.test(val)) uuids.add(val);
    }
  }
  if (uuids.size === 0) return {};

  const ids = Array.from(uuids);
  const [statesR, munisR, citiesR, parishesR] = await Promise.all([
    supabase.from("states").select("id, name").in("id", ids),
    supabase.from("municipalities").select("id, name").in("id", ids),
    supabase.from("cities").select("id, name").in("id", ids),
    supabase.from("parishes").select("id, name").in("id", ids),
  ]);

  const cache: Record<string, string> = {};
  for (const row of statesR.data || []) cache[row.id] = row.name;
  for (const row of munisR.data || []) cache[row.id] = row.name;
  for (const row of citiesR.data || []) cache[row.id] = row.name;
  for (const row of parishesR.data || []) cache[row.id] = row.name;
  return cache;
}

function lugarNacimientoFromForm(
  fd: Record<string, unknown>,
  geoCache: Record<string, string>,
): string {
  const city = resolveGeoName(fd.ciudad_nacimiento as string, geoCache);
  if (city) return city;
  const muni = resolveGeoName(fd.municipio_nacimiento as string, geoCache);
  if (muni) return muni;
  const parish = resolveGeoName(fd.parroquia_nacimiento as string, geoCache);
  if (parish) return parish;
  const lugar = fd.lugar_nacimiento;
  if (typeof lugar === "string" && lugar.trim()) {
    return resolveGeoName(lugar, geoCache) || lugar.trim();
  }
  return "";
}

function entidadFederalFromForm(
  fd: Record<string, unknown>,
  geoCache: Record<string, string>,
): string {
  const ef = fd.entidad_federal;
  if (typeof ef === "string" && ef.trim() && !GEO_UUID_PATTERN.test(ef.trim())) {
    return ef.trim().toUpperCase().substring(0, 2);
  }
  const state = resolveGeoName(fd.estado_nacimiento as string, geoCache);
  if (state) return state.toUpperCase().substring(0, 2);
  return "";
}

export async function fetchResumenFinalDocxData(
  schoolId: string,
  schoolYearId: string,
  sectionId: string,
  parte: number
): Promise<ResumenFinalDocxData> {
  if (!schoolId || !schoolYearId || !sectionId) throw new Error("Missing params");

  // 1. school year range
  const { data: yearData } = await supabase
    .from("school_years").select("year_range").eq("id", schoolYearId).single();

  // 2. school config
  const { data: planillaConfig } = await supabase
    .from("planilla_general_config")
    .select("school_header, education_codes")
    .eq("school_id", schoolId)
    .maybeSingle();
  const schoolHeader = (planillaConfig?.school_header as Record<string, string>) ?? {};
  const educationCodes = (planillaConfig?.education_codes ?? {}) as {
    menciones_seccion?: Record<
      string,
      Record<string, { tipo?: string; mencion_texto?: string }>
    >;
  };

  // 3. section info
  const { data: section } = await supabase
    .from("sections").select("grade_level, name").eq("id", sectionId).single();

  // 3b. tipo de planilla (define layout GP/GRUPO vs productivas mezcladas)
  const { data: rfConfig } = await supabase
    .from("resumen_final_config")
    .select("tipo_planilla, observaciones, nombre_profesor, cedula_profesor")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId)
    .eq("parte", parte)
    .maybeSingle();
  const tipoPlanilla = (rfConfig?.tipo_planilla as "31059" | "31060") ?? "31059";
  const useGpGrupoColumns = tipoPlanilla === "31059";

  // 4. enrollments → student IDs, ordered
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId);
  const allStudentIds = (enrollments ?? []).map(e => e.student_id);
  const totalStudentsInSection = allStudentIds.length;
  const start = (parte - 1) * 35;
  const pageStudentIds = allStudentIds.slice(start, start + 35);

  if (pageStudentIds.length === 0) throw new Error("No students for this parte");

  // 5. students data
  const { data: students } = await supabase
    .from("students")
    .select("id, document_id, form_data")
    .in("id", pageStudentIds);
  const studentsMap = new Map((students ?? []).map(s => [s.id, s]));

  // 6. regular subject assignments for this section
  const regularAssignments = await fetchRegularAssignmentsForSection(schoolId, schoolYearId, sectionId);

  // 7a. Productive (non-regular) assignments via section: orientacion, innovacion, etc.
  const { data: sectionProductiveData, error: sectProdError } = await supabase
    .from("subject_teacher_assignments")
    .select("id, subject_id, teacher:teacher_id(id, document_id, form_data), school_subjects(id, name, abbreviation, display_order, show_in_planilla, evaluation_type, subject_type, is_suspended)")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId)
    .eq("is_suspended", false);
  if (sectProdError) throw new Error(`Error al cargar materias productivas: ${sectProdError.message}`);
  const sectionProductiveAssignments = dedupeAssignmentsBySubject(
    ((sectionProductiveData ?? []) as AssignmentWithSubject[]).filter(isProductivePlanillaAssignment),
  );

  // 7b. GCRP assignments via gcrp_assignment_students (linked per-student, not per-section)
  const { data: gcrpLinks, error: gcrpLinksError } = await supabase
    .from("gcrp_assignment_students")
    .select("assignment_id, student_id")
    .eq("school_id", schoolId)
    .in("student_id", pageStudentIds);
  if (gcrpLinksError) throw new Error(`Error al cargar asignaciones GCRP: ${gcrpLinksError.message}`);

  const gcrpAssignmentIds = [...new Set((gcrpLinks ?? []).map(l => l.assignment_id))];
  let gcrpAssignmentsData: AssignmentWithSubject[] = [];
  if (gcrpAssignmentIds.length > 0) {
    const { data, error: gcrpAssignError } = await supabase
      .from("subject_teacher_assignments")
      .select("id, subject_id, teacher:teacher_id(id, document_id, form_data), school_subjects(id, name, abbreviation, display_order, show_in_planilla, evaluation_type, subject_type, is_suspended)")
      .in("id", gcrpAssignmentIds)
      .eq("school_year_id", schoolYearId)
      .eq("is_suspended", false);
    if (gcrpAssignError) throw new Error(`Error al cargar materias GCRP: ${gcrpAssignError.message}`);
    const gcrpFilter = useGpGrupoColumns
      ? isGcrpPlanillaAssignment
      : isMergedProductivePlanillaAssignment;
    gcrpAssignmentsData = dedupeAssignmentsBySubject(
      ((data ?? []) as AssignmentWithSubject[]).filter(gcrpFilter),
    );
  }

  const gcrpOrder = new Map(
    gcrpAssignmentsData.map((a, i) => [a.id, a.school_subjects?.display_order ?? i]),
  );
  const studentGcrpAssignments = new Map<string, string[]>();
  if (useGpGrupoColumns) {
    const sortedGcrpLinks = [...(gcrpLinks ?? [])].sort((a, b) => {
      const oa = gcrpOrder.get(a.assignment_id) ?? 999;
      const ob = gcrpOrder.get(b.assignment_id) ?? 999;
      return oa - ob;
    });
    sortedGcrpLinks.forEach((l) => {
      if (!gcrpAssignmentIds.includes(l.assignment_id)) return;
      const list = studentGcrpAssignments.get(l.student_id) ?? [];
      if (!list.includes(l.assignment_id)) list.push(l.assignment_id);
      studentGcrpAssignments.set(l.student_id, list);
    });
  }

  const productiveAssignments = useGpGrupoColumns
    ? sectionProductiveAssignments
    : dedupeAssignmentsBySubject([
        ...sectionProductiveAssignments,
        ...gcrpAssignmentsData,
      ]);

  // 8. all assignment IDs for grade query
  const allAssignmentIds = [
    ...regularAssignments.map(a => a.id),
    ...productiveAssignments.map(a => a.id),
    ...(useGpGrupoColumns ? gcrpAssignmentsData.map(a => a.id) : []),
  ];

  // 9. notas definitivas guardadas (momento = 0, periodo cero)
  let gradesData: GradeRecord[] = [];
  if (allAssignmentIds.length > 0 && pageStudentIds.length > 0) {
    const { data, error: gradesError } = await supabase
      .from("final_grades")
      .select("student_id, assignment_id, grade_value, adjustment_points, final_status, absence_count, attendance_count")
      .eq("school_id", schoolId)
      .eq("momento", 0)
      .in("assignment_id", allAssignmentIds)
      .in("student_id", pageStudentIds);
    if (gradesError) throw new Error(`Error al cargar notas definitivas: ${gradesError.message}`);
    gradesData = (data ?? []) as GradeRecord[];
  }

  // 10. subject name/abbreviation overrides for this planilla type
  const { data: overridesData } = await supabase
    .from("resumen_final_subject_overrides")
    .select("subject_id, custom_name, custom_abbreviation")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("planilla_type", tipoPlanilla);
  const overridesMap = new Map(
    ((overridesData ?? []) as Array<{ subject_id: string; custom_name: string | null; custom_abbreviation: string | null }>)
      .map((o) => [o.subject_id, o]),
  );

  const regularSubjects: SubjectCol[] = regularAssignments.map(a => {
    const s = a.school_subjects!;
    const t = (a.teacher as any);
    const ov = overridesMap.get(s.id);
    return {
      id: s.id,
      name: ov?.custom_name || s.name,
      abbreviation: ov?.custom_abbreviation || s.abbreviation || s.name.substring(0, 2).toUpperCase(),
      evaluationType: s.evaluation_type || "numeric",
      isGcrp: false,
      assignmentId: a.id,
      teacherName: teacherName(t?.form_data),
      teacherCedula: t?.document_id || "",
    };
  });

  const productiveSubjects: SubjectCol[] = productiveAssignments.map(a => {
    const s = a.school_subjects!;
    const t = (a.teacher as any);
    const ov = overridesMap.get(s.id);
    return {
      id: s.id,
      name: ov?.custom_name || s.name,
      abbreviation: ov?.custom_abbreviation || s.abbreviation || s.name.substring(0, 2).toUpperCase(),
      evaluationType: s.evaluation_type || "numeric",
      isGcrp: useGpGrupoColumns ? false : s.subject_type === "gcrp",
      assignmentId: a.id,
      teacherName: teacherName(t?.form_data),
      teacherCedula: t?.document_id || "",
    };
  });

  const gradeKey = (sid: string, aid: string) => `${sid}:${aid}`;
  const gradeMap = new Map<string, GradeRecord>();
  gradesData.forEach((g) => gradeMap.set(gradeKey(g.student_id, g.assignment_id), g));

  const geoCache = await buildGeoCache(
    pageStudentIds
      .map((sid) => (studentsMap.get(sid)?.form_data || {}) as Record<string, unknown>)
      .filter((fd) => Object.keys(fd).length > 0),
  );

  const studentRows: StudentDocxRow[] = pageStudentIds.map((sid, idx) => {
    const student = studentsMap.get(sid);
    const fd = (student?.form_data || {}) as Record<string, unknown>;

    const apellidos = [fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ").toUpperCase();
    const nombres = [fd.primer_nombre, fd.segundo_nombre].filter(Boolean).join(" ").toUpperCase();

    const grades: Record<string, string> = {};
    [...regularAssignments, ...productiveAssignments].forEach((a) => {
      const g = gradeMap.get(gradeKey(sid, a.id));
      const subj = a.school_subjects;
      if (g && subj) {
        grades[a.id] = gradeDisplay(
          g.grade_value,
          g.adjustment_points,
          subj.evaluation_type || "numeric",
          g.final_status,
        );
      } else {
        grades[a.id] = "";
      }
    });

    let gpGrade = "";
    let grupoName = "";
    if (useGpGrupoColumns) {
      const gcrpIds = studentGcrpAssignments.get(sid) ?? [];
      const gp = computeGpGradeAndGrupo(
        sid,
        gcrpIds,
        gcrpAssignmentsData,
        gradeMap,
        gradeKey,
      );
      gpGrade = gp.gpGrade;
      grupoName = gp.grupoName.toUpperCase();
    }

    let diaNac = "", mesNac = "", anioNac = "";
    const fechaNac = fd.fecha_nacimiento as string | undefined;
    if (fechaNac) {
      const parts = fechaNac.split("-");
      if (parts.length === 3) { anioNac = parts[0]; mesNac = parts[1]; diaNac = parts[2]; }
    } else {
      diaNac = String(fd.dia_nacimiento || "");
      mesNac = String(fd.mes_nacimiento || "");
      anioNac = String(fd.anio_nacimiento || "");
    }

    return {
      nro: idx + 1,
      cedula: student?.document_id || "",
      apellidos,
      nombres,
      lugarNacimiento: lugarNacimientoFromForm(fd, geoCache).toUpperCase(),
      entidadFederal: entidadFederalFromForm(fd, geoCache),
      sexo: (fd.sexo || fd.genero || "").toUpperCase().substring(0, 1),
      diaNac,
      mesNac,
      anioNac,
      grades,
      gpGrade,
      grupoName,
    };
  });

  const allSubjects = [...regularSubjects, ...productiveSubjects];
  const subjectTotals = computeSubjectAreaTotals(
    pageStudentIds,
    studentRows,
    allSubjects,
    gradeMap,
  );

  const mencionConfig =
    educationCodes.menciones_seccion?.[schoolYearId]?.[sectionId];
  const planEstudio = resolvePlanEstudio(
    tipoPlanilla,
    mencionConfig?.mencion_texto,
  );

  return {
    schoolHeader,
    yearRange: yearData?.year_range || schoolYearId,
    sectionGradeLevel: section?.grade_level || "",
    sectionName: section?.name || "",
    parte,
    totalStudentsInSection,
    studentsInPage: studentRows.length,
    regularSubjects,
    productiveSubjects,
    students: studentRows,
    tipoPlanilla,
    planEstudio,
    observaciones: rfConfig?.observaciones || "",
    nombreProfesor: rfConfig?.nombre_profesor || "",
    cedulaProfesor: rfConfig?.cedula_profesor || "",
    subjectTotals,
  };
}

export function useResumenFinalDocxData(schoolYearId: string, sectionId: string, parte: number) {
  const { schoolId } = useSchoolId();

  return useQuery({
    queryKey: ["resumen-final-docx", schoolId, schoolYearId, sectionId, parte],
    queryFn: () => fetchResumenFinalDocxData(schoolId!, schoolYearId, sectionId, parte),
    enabled: !!schoolId && !!schoolYearId && !!sectionId && parte > 0,
  });
}
