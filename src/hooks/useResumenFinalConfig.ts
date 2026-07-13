import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";

export interface ResumenFinalConfigRow {
  id?: string;
  school_id: string;
  school_year_id: string;
  section_id: string;
  parte: number;
  tipo_planilla: "31059" | "31060";
  observaciones: string;
  nombre_profesor: string;
  cedula_profesor: string;
}

export interface SectionPart {
  section: {
    id: string;
    grade_level: string;
    name: string;
  };
  parte: number;
  studentCount: number;
  totalParts: number;
  config: Omit<ResumenFinalConfigRow, "id" | "school_id" | "school_year_id" | "section_id" | "parte"> | null;
}

function calcParts(studentCount: number): number {
  return Math.max(1, Math.ceil(studentCount / 35));
}

const ALL_GRADE_ORDER = [
  "pre_maternal", "maternal",
  "i_nivel", "ii_nivel", "iii_nivel",
  "1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado",
  "1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano",
];

export function useResumenFinalConfig(schoolYearId: string) {
  const { schoolId } = useSchoolId();
  const qc = useQueryClient();

  // All sections with enrollment counts for the selected year
  const { data: sectionParts = [], isLoading } = useQuery({
    queryKey: ["resumen-final-sections", schoolId, schoolYearId],
    queryFn: async () => {
      if (!schoolId || !schoolYearId) return [];

      // Fetch all sections for this school
      const { data: sections, error: sectionsError } = await supabase
        .from("sections")
        .select("id, grade_level, name")
        .eq("school_id", schoolId);
      if (sectionsError) throw sectionsError;
      if (!sections?.length) return [];

      // Fetch enrollment counts for selected year
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("section_id, student_id")
        .eq("school_id", schoolId)
        .eq("school_year_id", schoolYearId);
      if (enrollError) throw enrollError;

      const countMap = new Map<string, number>();
      enrollments?.forEach((e) => {
        countMap.set(e.section_id, (countMap.get(e.section_id) ?? 0) + 1);
      });

      // Fetch existing configs for this year
      const { data: configs, error: configError } = await supabase
        .from("resumen_final_config")
        .select("*")
        .eq("school_id", schoolId)
        .eq("school_year_id", schoolYearId);
      if (configError) throw configError;

      const configMap = new Map<string, ResumenFinalConfigRow>();
      configs?.forEach((c) => {
        configMap.set(`${c.section_id}__${c.parte}`, c as ResumenFinalConfigRow);
      });

      // Build sectionParts — only include sections with ≥1 enrolled student
      const result: SectionPart[] = [];
      for (const section of sections) {
        const count = countMap.get(section.id) ?? 0;
        if (count === 0) continue;

        const totalParts = calcParts(count);
        for (let parte = 1; parte <= totalParts; parte++) {
          const raw = configMap.get(`${section.id}__${parte}`);
          result.push({
            section,
            parte,
            studentCount: count,
            totalParts,
            config: raw
              ? { tipo_planilla: raw.tipo_planilla, observaciones: raw.observaciones, nombre_profesor: raw.nombre_profesor, cedula_profesor: raw.cedula_profesor }
              : null,
          });
        }
      }

      // Sort by grade level order → section name → parte
      result.sort((a, b) => {
        const iA = ALL_GRADE_ORDER.indexOf(a.section.grade_level);
        const iB = ALL_GRADE_ORDER.indexOf(b.section.grade_level);
        if (iA !== iB) return iA - iB;
        const nameComp = a.section.name.localeCompare(b.section.name);
        if (nameComp !== 0) return nameComp;
        return a.parte - b.parte;
      });

      return result;
    },
    enabled: !!schoolId && !!schoolYearId,
  });

  const saveConfig = useMutation({
    mutationFn: async (payload: Omit<ResumenFinalConfigRow, "id">) => {
      const { error } = await supabase
        .from("resumen_final_config")
        .upsert(payload, { onConflict: "school_id,school_year_id,section_id,parte" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resumen-final-sections", schoolId, schoolYearId] });
    },
  });

  return { sectionParts, isLoading, saveConfig, schoolId };
}
