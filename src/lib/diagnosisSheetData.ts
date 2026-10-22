import { supabase } from "@/integrations/supabase/client";
import { BoletinSignature } from "@/lib/bachilleratoTemplate";
import {
  DiagnosisImages,
  DiagnosisSections,
  DiagnosisSheetData,
  generateDiagnosisDocumentHtml,
} from "@/lib/diagnosisSheet";
import { gradeLabel } from "@/lib/gradeLevels";
import { resolveImageToDataUrl, resolveSignatureImages } from "@/lib/image-resolve";
import { untypedSupabase } from "@/lib/untypedSupabase";
import { teacherDisplayName } from "@/lib/teacherName";
import diagnosisHeaderUrl from "@/assets/diagnosis-header.png";
import diagnosisFooterUrl from "@/assets/diagnosis-footer.png";

/**
 * Data side of the diagnosis sheet: everything the render needs, resolved from an assignment
 * (docente × área × sección × año). Works for the teacher and for school staff — both can read
 * the tables involved.
 */

export const DIAGNOSIS_TEACHER_CARGO = "Docente";

export interface DiagnosisStudentRef {
  studentId: string;
  studentName: string;
  documentId: string | null;
}

interface AssignmentContext {
  schoolId: string;
  schoolName: string;
  schoolYearId: string;
  yearRange: string;
  teacherId: string;
  /** Null for GCRP: the grade and section then come from each student's enrolment. */
  section: { name: string; grade_level: string } | null;
}

let imagesPromise: Promise<DiagnosisImages> | null = null;

/** The fixed Ministry header and flag footer, inlined once per session. */
function loadDiagnosisImages(): Promise<DiagnosisImages> {
  imagesPromise ??= Promise.all([
    resolveImageToDataUrl(diagnosisHeaderUrl),
    resolveImageToDataUrl(diagnosisFooterUrl),
  ]).then(([headerLogo, footerLogo]) => {
    // A failed fetch must not stick for the whole session.
    if (!headerLogo || !footerLogo) imagesPromise = null;
    return { headerLogo, footerLogo };
  });
  return imagesPromise;
}

type SectionRef = { name: string; grade_level: string };

interface AssignmentRow {
  school_id: string;
  school_year_id: string;
  teacher_id: string;
  section: SectionRef | null;
  school_year: { year_range: string } | null;
  school: { name: string } | null;
}

async function fetchAssignmentContext(assignmentId: string): Promise<AssignmentContext> {
  const { data, error } = await supabase
    .from("subject_teacher_assignments")
    .select(
      "school_id, school_year_id, teacher_id, section:section_id(name, grade_level), school_year:school_year_id(year_range), school:school_id(name)",
    )
    .eq("id", assignmentId)
    .single();
  if (error) throw error;
  const row = data as unknown as AssignmentRow;
  return {
    schoolId: row.school_id,
    schoolName: row.school?.name ?? "",
    schoolYearId: row.school_year_id,
    yearRange: row.school_year?.year_range ?? "",
    teacherId: row.teacher_id,
    section: row.section ?? null,
  };
}

/** Grade and section of each student in the assignment's school year. */
async function fetchStudentSections(
  ctx: AssignmentContext,
  studentIds: string[],
): Promise<Map<string, SectionRef>> {
  const map = new Map<string, SectionRef>();
  if (ctx.section) {
    studentIds.forEach((id) => map.set(id, ctx.section!));
    return map;
  }
  const { data } = await supabase
    .from("enrollments")
    .select("student_id, section:section_id(name, grade_level)")
    .eq("school_year_id", ctx.schoolYearId)
    .in("student_id", studentIds);
  ((data ?? []) as unknown as { student_id: string; section: SectionRef | null }[]).forEach((row) => {
    if (row.section) map.set(row.student_id, row.section);
  });
  return map;
}

/**
 * The teacher signs first. Their own signature (the one used on the boleta) when it exists — an
 * inactive one is respected and not printed. Without a saved signature, the name from their record.
 */
async function fetchTeacherSignature(teacherId: string): Promise<BoletinSignature | null> {
  const [sigRes, teacherRes] = await Promise.all([
    supabase
      .from("teacher_signatures")
      .select("nombre, cedula, cargo, firma_url, sello_url, is_active")
      .eq("teacher_id", teacherId)
      .maybeSingle(),
    supabase.from("teachers").select("form_data").eq("id", teacherId).maybeSingle(),
  ]);
  const sig = sigRes.data as (BoletinSignature & { is_active: boolean }) | null;
  if (sig) {
    if (!sig.is_active) return null;
    const { is_active: _active, ...rest } = sig;
    return { ...rest, cargo: rest.cargo?.trim() || DIAGNOSIS_TEACHER_CARGO };
  }
  return {
    nombre: teacherDisplayName(teacherRes.data?.form_data),
    cedula: "",
    cargo: DIAGNOSIS_TEACHER_CARGO,
    firma_url: "",
    sello_url: "",
  };
}

async function fetchInstitutionalSignatures(schoolId: string): Promise<BoletinSignature[]> {
  const { data } = await untypedSupabase
    .from("grades_config")
    .select("diagnosis_signatures")
    .eq("school_id", schoolId)
    .maybeSingle();
  const sigs = ((data as { diagnosis_signatures?: BoletinSignature[] } | null)?.diagnosis_signatures ?? []);
  return sigs.filter((s) => s.enabled !== false);
}

async function fetchSavedDiagnoses(assignmentId: string, studentIds: string[]) {
  const { data, error } = await untypedSupabase
    .from("student_diagnoses")
    .select("student_id, strengths, weaknesses, improvements")
    .eq("assignment_id", assignmentId)
    .in("student_id", studentIds);
  if (error) throw error;
  const map = new Map<string, DiagnosisSections>();
  ((data ?? []) as (DiagnosisSections & { student_id: string })[]).forEach((row) => map.set(row.student_id, row));
  return map;
}

/** Everything but the text: loaded once, then any number of sheets are composed from it. */
export interface DiagnosisDocumentContext {
  schoolName: string;
  yearRange: string;
  sections: Map<string, SectionRef>;
  saved: Map<string, DiagnosisSections>;
  signatures: BoletinSignature[];
  images: DiagnosisImages;
}

export async function loadDiagnosisContext(assignmentId: string, studentIds: string[]): Promise<DiagnosisDocumentContext> {
  const ctx = await fetchAssignmentContext(assignmentId);
  const [sections, saved, teacherSig, institutional, images] = await Promise.all([
    fetchStudentSections(ctx, studentIds),
    fetchSavedDiagnoses(assignmentId, studentIds),
    fetchTeacherSignature(ctx.teacherId),
    fetchInstitutionalSignatures(ctx.schoolId),
    loadDiagnosisImages(),
  ]);
  const signatures = await resolveSignatureImages(teacherSig ? [teacherSig, ...institutional] : institutional);
  return { schoolName: ctx.schoolName, yearRange: ctx.yearRange, sections, saved, signatures, images };
}

/**
 * Full HTML document with one sheet per student, ready for `htmlToPdfBlob` or an iframe.
 * `overrides` holds unsaved text from the editor, by student, and wins over what is stored.
 */
export function composeDiagnosisDocument(
  context: DiagnosisDocumentContext,
  students: DiagnosisStudentRef[],
  overrides: Record<string, DiagnosisSections> = {},
): string {
  const sheets: DiagnosisSheetData[] = students.map((s) => {
    const section = context.sections.get(s.studentId);
    const content = overrides[s.studentId] ?? context.saved.get(s.studentId);
    return {
      schoolName: context.schoolName,
      yearRange: context.yearRange,
      studentName: s.studentName,
      documentId: s.documentId,
      gradeLabel: gradeLabel(section?.grade_level),
      sectionName: section?.name ?? null,
      strengths: content?.strengths ?? "",
      weaknesses: content?.weaknesses ?? "",
      improvements: content?.improvements ?? "",
      signatures: context.signatures,
    };
  });
  return generateDiagnosisDocumentHtml(sheets, context.images);
}

/** Loads the latest data and composes the document — what the PDF downloads use. */
export async function buildDiagnosisDocument(assignmentId: string, students: DiagnosisStudentRef[]): Promise<string> {
  const context = await loadDiagnosisContext(assignmentId, students.map((s) => s.studentId));
  return composeDiagnosisDocument(context, students);
}
