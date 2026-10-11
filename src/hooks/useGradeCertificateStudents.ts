import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { CERTIFICATE_GRADE_LEVELS } from "@/lib/grade-certificate";
import { type CertificateEnrollmentRow, buildCertificateStudentList } from "@/lib/grade-certificate-students";

/** Only the name keys of `form_data`: the list covers every year, so the whole JSON is not downloaded. */
const ENROLLMENT_SELECT =
  "student_id, sections!inner(grade_level, name), school_years!inner(year_range), "
  + "student:student_id(document_id, status, primer_nombre:form_data->>primer_nombre, "
  + "segundo_nombre:form_data->>segundo_nombre, primer_apellido:form_data->>primer_apellido, "
  + "segundo_apellido:form_data->>segundo_apellido, nombre:form_data->>nombre, apellido:form_data->>apellido)";

interface EnrollmentQueryRow {
  student_id: string;
  sections: { grade_level: string; name: string };
  school_years: { year_range: string };
  student: ({ document_id: string | null; status: string | null } & Record<string, string | null>) | null;
}

export const gradeCertificateStudentsKey = (schoolId: string | null | undefined) =>
  ["grade-certificate-students", schoolId] as const;

/** Every student ever enrolled in 1er–5to año, with a mark on those that already have a certificate. */
export function useGradeCertificateStudents() {
  const { schoolId } = useSchoolId();

  return useQuery({
    queryKey: gradeCertificateStudentsKey(schoolId),
    queryFn: async () => {
      const [enrollments, certificates] = await Promise.all([
        fetchAllRows<EnrollmentQueryRow>((from, to) =>
          supabase
            .from("enrollments")
            .select(ENROLLMENT_SELECT)
            .eq("school_id", schoolId!)
            .in("sections.grade_level", [...CERTIFICATE_GRADE_LEVELS])
            .order("id")
            .range(from, to) as unknown as PromiseLike<{ data: EnrollmentQueryRow[] | null; error: { message: string } | null }>),
        fetchAllRows((from, to) =>
          supabase
            .from("grade_certificates")
            .select("student_id")
            .eq("school_id", schoolId!)
            .order("student_id")
            .range(from, to)),
      ]);

      const rows: CertificateEnrollmentRow[] = enrollments.map((e) => ({
        studentId: e.student_id,
        gradeLevel: e.sections.grade_level,
        sectionName: e.sections.name,
        yearRange: e.school_years.year_range,
        documentId: e.student?.document_id ?? null,
        status: e.student?.status ?? null,
        nameFields: e.student,
      }));
      return buildCertificateStudentList(rows, certificates.map((c) => c.student_id));
    },
    enabled: !!schoolId,
  });
}
