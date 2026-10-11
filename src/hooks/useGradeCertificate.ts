import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { gradeCertificateStudentsKey } from "@/hooks/useGradeCertificateStudents";
import {
  type GradeCertificateDocument,
  parseGradeCertificate,
  serializeGradeCertificate,
} from "@/lib/grade-certificate";

/** Loads and saves the Certificación de Notas of one student (one row in `grade_certificates`). */
export function useGradeCertificate(studentId: string | null) {
  const { schoolId } = useSchoolId();
  const qc = useQueryClient();
  const queryKey = ["grade-certificate", schoolId, studentId];

  const { data: certificate, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_certificates")
        .select("institutions, year_records, observations, issue_date")
        .eq("school_id", schoolId!)
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return parseGradeCertificate(data);
    },
    enabled: !!schoolId && !!studentId,
  });

  const saveCertificate = useMutation({
    mutationFn: async (document: GradeCertificateDocument) => {
      const { error } = await supabase
        .from("grade_certificates")
        .upsert(
          { school_id: schoolId!, student_id: studentId!, ...serializeGradeCertificate(document) },
          { onConflict: "school_id,student_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey }),
      qc.invalidateQueries({ queryKey: gradeCertificateStudentsKey(schoolId) }),
    ]),
  });

  return { certificate, isLoading, saveCertificate };
}
