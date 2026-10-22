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
 * Data side of the diagnosis sheet: everything the render needs, resolved from the section's main
 * assignment (docente guía × sección × año). Works for the teacher and for school staff — both can
 * read the tables involved.
 */

export const DIAGNOSIS_TEACHER_CARGO = "Docente";

/** The student fields a sheet prints — a `GradeStudent` fits as is. */
export interface DiagnosisStudentRef {
  student_id: string;
  full_name: string;
  document_id: string | null;
}

interface AssignmentRow {
  school_id: string;
  teacher_id: string;
  section: { name: string; grade_level: string } | null;
  school_year: { year_range: string } | null;
  school: { name: string } | null;
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

async function fetchAssignment(assignmentId: string): Promise<AssignmentRow> {
  const { data, error } = await supabase
    .from("subject_teacher_assignments")
    .select("school_id, teacher_id, section:section_id(name, grade_level), school_year:school_year_id(year_range), school:school_id(name)")
    .eq("id", assignmentId)
    .single();
  if (error) throw error;
  return data as unknown as AssignmentRow;
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
  const sigs = (data as { diagnosis_signatures?: BoletinSignature[] } | null)?.diagnosis_signatures ?? [];
  return sigs.filter((s) => s.enabled !== false);
}

async function fetchSavedDiagnoses(assignmentId: string): Promise<Map<string, DiagnosisSections>> {
  const { data, error } = await untypedSupabase
    .from("student_diagnoses")
    .select("student_id, strengths, weaknesses, improvements")
    .eq("assignment_id", assignmentId);
  if (error) throw error;
  const map = new Map<string, DiagnosisSections>();
  ((data ?? []) as (DiagnosisSections & { student_id: string })[]).forEach((row) => map.set(row.student_id, row));
  return map;
}

/** Everything but the student rows: loaded once, then any number of sheets are composed from it. */
export interface DiagnosisDocumentContext {
  schoolName: string;
  yearRange: string;
  gradeLabel: string;
  sectionName: string | null;
  saved: Map<string, DiagnosisSections>;
  signatures: BoletinSignature[];
  images: DiagnosisImages;
}

export async function loadDiagnosisContext(assignmentId: string): Promise<DiagnosisDocumentContext> {
  const assignment = await fetchAssignment(assignmentId);
  const [saved, teacherSig, institutional, images] = await Promise.all([
    fetchSavedDiagnoses(assignmentId),
    fetchTeacherSignature(assignment.teacher_id),
    fetchInstitutionalSignatures(assignment.school_id),
    loadDiagnosisImages(),
  ]);
  return {
    schoolName: assignment.school?.name ?? "",
    yearRange: assignment.school_year?.year_range ?? "",
    gradeLabel: gradeLabel(assignment.section?.grade_level),
    sectionName: assignment.section?.name ?? null,
    saved,
    signatures: await resolveSignatureImages(teacherSig ? [teacherSig, ...institutional] : institutional),
    images,
  };
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
    const content = overrides[s.student_id] ?? context.saved.get(s.student_id);
    return {
      schoolName: context.schoolName,
      yearRange: context.yearRange,
      studentName: s.full_name,
      documentId: s.document_id,
      gradeLabel: context.gradeLabel,
      sectionName: context.sectionName,
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
  return composeDiagnosisDocument(await loadDiagnosisContext(assignmentId), students);
}
