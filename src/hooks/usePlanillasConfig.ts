import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";

export interface SchoolHeader {
  codigo_plantel: string;
  nombre_plantel: string;
  telefono_plantel: string;
  entidad_federal: string;
  zona_educativa: string;
  director: string;
  cedula_director: string;
  direccion_plantel: string;
  municipio_plantel: string;
  fecha_remision: string;
  coordinador_control_estudio: string;
  cedula_coordinador: string;
  funcionario_ministerio: string;
  cedula_funcionario: string;
}

export interface SeccionMencionConfig {
  tipo: "con_mencion" | "sin_mencion";
  mencion_texto: string;
}

export interface EducationCodes {
  educacion_inicial: string;
  codigos_educacion_inicial: string;
  educacion_primaria: string;
  codigos_educacion_primaria: string;
  educacion_media_general: string;
  educacion_media_tecnica: string;
  codigo_titulo: string;
  codigo_mencion: string;
  mencion_media_general: string;
  menciones_seccion: Record<string, SeccionMencionConfig>;
}

export interface RfreConfig {
  acronimo_gcrp: string;
}

export interface PlanillasConfig {
  id: string;
  school_id: string;
  school_header: SchoolHeader;
  education_codes: EducationCodes;
  rfre_config: RfreConfig;
}

const EMPTY_SCHOOL_HEADER: SchoolHeader = {
  codigo_plantel: "",
  nombre_plantel: "",
  telefono_plantel: "",
  entidad_federal: "",
  zona_educativa: "",
  director: "",
  cedula_director: "",
  direccion_plantel: "",
  municipio_plantel: "",
  fecha_remision: "",
  coordinador_control_estudio: "",
  cedula_coordinador: "",
  funcionario_ministerio: "",
  cedula_funcionario: "",
};

const EMPTY_EDUCATION_CODES: EducationCodes = {
  educacion_inicial: "",
  codigos_educacion_inicial: "",
  educacion_primaria: "",
  codigos_educacion_primaria: "",
  educacion_media_general: "",
  educacion_media_tecnica: "",
  codigo_titulo: "",
  codigo_mencion: "31060",
  mencion_media_general: "",
  menciones_seccion: {},
};

const EMPTY_RFRE_CONFIG: RfreConfig = {
  acronimo_gcrp: "",
};

export function usePlanillasConfig() {
  const { schoolId } = useSchoolId();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["planillas-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planilla_general_config")
        .select("id, school_id, school_header, education_codes, rfre_config")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw error;
      return data as PlanillasConfig | null;
    },
    enabled: !!schoolId,
  });

  const saveSchoolHeader = useMutation({
    mutationFn: async (school_header: SchoolHeader) => {
      if (config?.id) {
        const { error } = await supabase
          .from("planilla_general_config")
          .update({ school_header })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("planilla_general_config")
          .insert({ school_id: schoolId!, school_header });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planillas-config", schoolId] }),
  });

  const saveEducationCodes = useMutation({
    mutationFn: async (education_codes: EducationCodes) => {
      if (config?.id) {
        const { error } = await supabase
          .from("planilla_general_config")
          .update({ education_codes })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("planilla_general_config")
          .insert({ school_id: schoolId!, education_codes });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planillas-config", schoolId] }),
  });

  const saveRfreConfig = useMutation({
    mutationFn: async (rfre_config: RfreConfig) => {
      if (config?.id) {
        const { error } = await supabase
          .from("planilla_general_config")
          .update({ rfre_config })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("planilla_general_config")
          .insert({ school_id: schoolId!, rfre_config });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planillas-config", schoolId] }),
  });

  return {
    config,
    isLoading,
    schoolHeader: (config?.school_header as SchoolHeader) ?? EMPTY_SCHOOL_HEADER,
    educationCodes: (config?.education_codes as EducationCodes) ?? EMPTY_EDUCATION_CODES,
    rfreConfig: (config?.rfre_config as RfreConfig) ?? EMPTY_RFRE_CONFIG,
    saveSchoolHeader,
    saveEducationCodes,
    saveRfreConfig,
  };
}
