import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildGeoCacheFromFormData, resolveGeoName } from "@/lib/geo-resolve";
import { buildCertificateStudentIdentity } from "@/lib/grade-certificate-identity";

/** "Datos de Identificación del Estudiante" of the certificate, read from the student's record. */
export function useCertificateStudentIdentity(studentId: string | null) {
  return useQuery({
    queryKey: ["grade-certificate-identity", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("document_id, form_data")
        .eq("id", studentId!)
        .single();
      if (error) throw error;

      const formData = (data.form_data ?? {}) as Record<string, unknown>;
      const geoCache = await buildGeoCacheFromFormData([formData]);
      return buildCertificateStudentIdentity(
        { document_id: data.document_id, form_data: formData },
        (value) => resolveGeoName(typeof value === "string" ? value : "", geoCache),
      );
    },
    enabled: !!studentId,
  });
}
