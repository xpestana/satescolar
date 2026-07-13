import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherOption {
  id: string;
  name: string;
  document_id: string | null;
  email: string | null;
  phone: string | null;
}

/** Derive a display name from the teacher's form_data (same fields the padrón uses). */
function deriveName(formData: Record<string, unknown> | null): string {
  const fd = formData ?? {};
  const parts = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return parts.join(" ").trim();
}

/** Teachers of the school, shaped for the beneficiary picker (category "Docente"). */
export function usePayrollTeachers(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["payroll-teachers", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<TeacherOption[]> => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, document_id, email, phone, form_data")
        .eq("school_id", schoolId as string);
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        name: deriveName(t.form_data as Record<string, unknown> | null) || "Docente sin nombre",
        document_id: t.document_id,
        email: t.email,
        phone: t.phone,
      }));
    },
  });
}
