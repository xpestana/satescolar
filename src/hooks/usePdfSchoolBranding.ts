import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PdfFooterConfig, PdfHeaderConfig } from "@/lib/export-utils";
import { toPdfSchoolInfo, type SchoolExportRow } from "@/lib/pdfSchoolBranding";

/** School row (with geo names) and letterhead toggles used by the PDF reports. */
export function usePdfSchoolBranding(schoolId: string | null | undefined) {
  const { data: school } = useQuery({
    queryKey: ["school-info-export", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("name, dea_code, statistical_code, address, logo_url, institution_type, phone, rif, states(name), municipalities(name), cities(name), parishes(name)")
        .eq("id", schoolId!)
        .single();
      if (error) throw error;
      return data as SchoolExportRow;
    },
    enabled: !!schoolId,
  });

  const { data: planillaConfig } = useQuery({
    queryKey: ["planilla-general-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planilla_general_config")
        .select("header_config, footer_config")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { header_config: PdfHeaderConfig; footer_config: PdfFooterConfig } | null;
    },
    enabled: !!schoolId,
  });

  return {
    school,
    schoolInfo: school ? toPdfSchoolInfo(school) : undefined,
    headerConfig: planillaConfig?.header_config,
    footerConfig: planillaConfig?.footer_config,
  };
}
