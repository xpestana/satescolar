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
  grades: Record<string, string>; // assignmentId → display value
  gcrpAssignmentId: string | null; // which GCRP assignment this student belongs to
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
  gcrpSubjects: SubjectCol[];
  // students (sliced for this parte, max 35)
  students: StudentDocxRow[];
  // config
  tipoPlanilla: "31059" | "31060";
  observaciones: string;
  nombreProfesor: string;
  cedulaProfesor: string;
  // totals
  inscritos: number;
  inasistentes: number;
  aprobados: number;
  noAprobados: number;
  noCursaron: number;
}

function gradeDisplay(gradeValue: string | null, adjPoints: number, evalType: string, finalStatus: string | null): string {
  if (evalType === "literal") return finalStatus ?? "";
  if (gradeValue == null || gradeValue === "") return "";
  const num = parseFloat(gradeValue) + (adjPoints ?? 0);
  if (isNaN(num)) return gradeValue;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function teacherName(fd: Record<string, any> | null): string {
  if (!fd) return "";
  return `${fd.primer_apellido || fd.apellido || ""} ${fd.segundo_apellido || ""} ${fd.primer_nombre || fd.nombre || ""} ${fd.segundo_nombre || ""}`.replace(/\s+/g, " ").trim().toUpperCase();
}

const CALC_PARTS = (count: number) => Math.max(1, Math.ceil(count / 35));

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
    .select("school_header").eq("school_id", schoolId).maybeSingle();
  const schoolHeader = (planillaConfig?.school_header as Record<string, string>) ?? {};

  // 3. section info
  const { data: section } = await supabase
    .from("sections").select("grade_level, name").eq("id", sectionId).single();

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
  const { data: regAssignments } = await supabase
    .from("subject_teacher_assignments")
    .select("id, subject_id, teacher:teacher_id(id, document_id, form_data), school_subjects(id, name, abbreviation, display_order, show_in_planilla, evaluation_type, subject_type)")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId)
    .eq("is_suspended", false);

  const regularAssignments = (regAssignments ?? [])
    .filter(a => (a.school_subjects as any)?.show_in_planilla !== false && (a.school_subjects as any)?.subject_type !== "gcrp")
    .sort((a, b) => ((a.school_subjects as any)?.display_order ?? 999) - ((b.school_subjects as any)?.display_order ?? 999));

  // 7. GCRP assignments via gcrp_assignment_students for these students
  const { data: gcrpLinks } = await supabase
    .from("gcrp_assignment_students")
    .select("assignment_id, student_id")
    .eq("school_id", schoolId)
    .in("student_id", pageStudentIds);

  const gcrpAssignmentIds = [...new Set((gcrpLinks ?? []).map(l => l.assignment_id))];
  let gcrpAssignmentsData: any[] = [];
  if (gcrpAssignmentIds.length > 0) {
    const { data } = await supabase
      .from("subject_teacher_assignments")
      .select("id, subject_id, teacher:teacher_id(id, document_id, form_data), school_subjects(id, name, abbreviation, display_order, show_in_planilla, evaluation_type, subject_type)")
      .in("id", gcrpAssignmentIds)
      .eq("is_suspended", false);
    gcrpAssignmentsData = (data ?? []).filter(a => (a.school_subjects as any)?.subject_type === "gcrp");
  }

  const studentGcrpMap = new Map<string, string>();
  (gcrpLinks ?? []).forEach(l => {
    if (gcrpAssignmentIds.includes(l.assignment_id)) {
      studentGcrpMap.set(l.student_id, l.assignment_id);
    }
  });

  // 8. all assignment IDs for grade query
  const allAssignmentIds = [
    ...regularAssignments.map(a => a.id),
    ...gcrpAssignmentsData.map(a => a.id),
  ];

  // 9. grades (momento=0 = definitiva guardada)
  let gradesData: any[] = [];
  if (allAssignmentIds.length > 0 && pageStudentIds.length > 0) {
    const { data } = await supabase
      .from("final_grades")
      .select("student_id, assignment_id, grade_value, adjustment_points, final_status, evaluation_type")
      .eq("school_id", schoolId)
      .eq("momento", 0)
      .in("assignment_id", allAssignmentIds)
      .in("student_id", pageStudentIds);
    gradesData = data ?? [];
  }

  // 10. resumen_final_config
  const { data: rfConfig } = await supabase
    .from("resumen_final_config")
    .select("tipo_planilla, observaciones, nombre_profesor, cedula_profesor")
    .eq("school_id", schoolId)
    .eq("school_year_id", schoolYearId)
    .eq("section_id", sectionId)
    .eq("parte", parte)
    .maybeSingle();

  const regularSubjects: SubjectCol[] = regularAssignments.map(a => {
    const s = a.school_subjects as any;
    const t = (a.teacher as any);
    return {
      id: s.id,
      name: s.name,
      abbreviation: s.abbreviation || s.name.substring(0, 2).toUpperCase(),
      evaluationType: s.evaluation_type || "numeric",
      isGcrp: false,
      assignmentId: a.id,
      teacherName: teacherName(t?.form_data),
      teacherCedula: t?.document_id || "",
    };
  });

  const gcrpSubjects: SubjectCol[] = gcrpAssignmentsData.map(a => {
    const s = a.school_subjects as any;
    const t = (a.teacher as any);
    return {
      id: s.id,
      name: s.name,
      abbreviation: s.abbreviation || s.name.substring(0, 2).toUpperCase(),
      evaluationType: s.evaluation_type || "numeric",
      isGcrp: true,
      assignmentId: a.id,
      teacherName: teacherName(t?.form_data),
      teacherCedula: t?.document_id || "",
    };
  });

  const gradeKey = (sid: string, aid: string) => `${sid}:${aid}`;
  const gradeMap = new Map<string, { grade_value: string | null; adjustment_points: number; final_status: string | null; evaluation_type: string | null }>();
  gradesData.forEach(g => gradeMap.set(gradeKey(g.student_id, g.assignment_id), g));

  const studentRows: StudentDocxRow[] = pageStudentIds.map((sid, idx) => {
    const student = studentsMap.get(sid);
    const fd = (student?.form_data || {}) as any;

    const apellidos = [fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ").toUpperCase();
    const nombres = [fd.primer_nombre, fd.segundo_nombre].filter(Boolean).join(" ").toUpperCase();

    const grades: Record<string, string> = {};
    [...regularAssignments, ...gcrpAssignmentsData].forEach(a => {
      const g = gradeMap.get(gradeKey(sid, a.id));
      const subj = a.school_subjects as any;
      if (g) {
        grades[a.id] = gradeDisplay(g.grade_value, g.adjustment_points, subj?.evaluation_type || "", g.final_status);
      } else {
        grades[a.id] = "";
      }
    });

    const gcrpAssignmentId = studentGcrpMap.get(sid) ?? null;
    const gcrpAssignment = gcrpAssignmentsData.find(a => a.id === gcrpAssignmentId);
    const grupoName = (gcrpAssignment?.school_subjects as any)?.name || "";

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
      nro: start + idx + 1,
      cedula: student?.document_id || "",
      apellidos,
      nombres,
      lugarNacimiento: (fd.lugar_nacimiento || fd.municipio_nacimiento || "").toUpperCase(),
      entidadFederal: (fd.entidad_federal || fd.estado_nacimiento || "").toUpperCase().substring(0, 2),
      sexo: (fd.sexo || fd.genero || "").toUpperCase().substring(0, 1),
      diaNac,
      mesNac,
      anioNac,
      grades,
      gcrpAssignmentId,
      grupoName: grupoName.toUpperCase(),
    };
  });

  const PASS_THRESHOLD = 10;
  let aprobados = 0, noAprobados = 0, inasistentes = 0;
  studentRows.forEach(row => {
    const regGrades = regularSubjects.map(s => row.grades[s.assignmentId]).filter(g => g !== "");
    if (regGrades.length === 0) { inasistentes++; return; }
    const numericGrades = regGrades.map(g => parseFloat(g)).filter(n => !isNaN(n));
    if (numericGrades.length === 0) { aprobados++; return; }
    const hasFailure = numericGrades.some(n => n < PASS_THRESHOLD);
    if (hasFailure) noAprobados++; else aprobados++;
  });
  const inscritos = studentRows.length;

  return {
    schoolHeader,
    yearRange: yearData?.year_range || schoolYearId,
    sectionGradeLevel: section?.grade_level || "",
    sectionName: section?.name || "",
    parte,
    totalStudentsInSection,
    studentsInPage: inscritos,
    regularSubjects,
    gcrpSubjects,
    students: studentRows,
    tipoPlanilla: (rfConfig?.tipo_planilla as "31059" | "31060") ?? "31059",
    observaciones: rfConfig?.observaciones || "",
    nombreProfesor: rfConfig?.nombre_profesor || "",
    cedulaProfesor: rfConfig?.cedula_profesor || "",
    inscritos,
    inasistentes,
    aprobados,
    noAprobados,
    noCursaron: 35 - inscritos,
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
