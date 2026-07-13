import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import {
  type EducationCodes,
  type SeccionMencionConfig,
  type usePlanillasConfig,
} from "@/hooks/usePlanillasConfig";

const SECONDARY_GRADES = ["1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano"] as const;
const GRADE_LABELS: Record<string, string> = {
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", "6_ano": "6to Año",
};

const DEFAULT_MENCION: SeccionMencionConfig = { tipo: "con_mencion", mencion_texto: "CIENCIA Y TECNOLOGÍA" };

type Props = ReturnType<typeof usePlanillasConfig>;

export function CodigosEducacion({ educationCodes, saveEducationCodes, isLoading }: Pick<Props, "educationCodes" | "saveEducationCodes" | "isLoading">) {
  const { schoolId } = useSchoolId();
  const [form, setForm] = useState<EducationCodes>(educationCodes);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  useEffect(() => { setForm(educationCodes); }, [educationCodes]);

  const set = (key: keyof EducationCodes) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Fetch school years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school-years-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("id, year_range, is_active")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
  });

  // Auto-select active year
  useEffect(() => {
    if (schoolYears.length && !selectedYearId) {
      const active = schoolYears.find((y) => y.is_active) ?? schoolYears[0];
      setSelectedYearId(active.id);
    }
  }, [schoolYears, selectedYearId]);

  // Fetch secondary sections (global per school, no year filter)
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["secondary-sections-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, grade_level, name")
        .eq("school_id", schoolId!)
        .in("grade_level", [...SECONDARY_GRADES])
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        const iA = SECONDARY_GRADES.indexOf(a.grade_level as any);
        const iB = SECONDARY_GRADES.indexOf(b.grade_level as any);
        return iA !== iB ? iA - iB : a.name.localeCompare(b.name);
      });
    },
    enabled: !!schoolId,
  });

  // Config for selected year + section
  const currentConfig: SeccionMencionConfig =
    form.menciones_seccion?.[selectedYearId]?.[selectedSection] ?? DEFAULT_MENCION;

  const updateSeccionConfig = (updates: Partial<SeccionMencionConfig>) => {
    if (!selectedYearId || !selectedSection) return;
    setForm((prev) => ({
      ...prev,
      menciones_seccion: {
        ...prev.menciones_seccion,
        [selectedYearId]: {
          ...prev.menciones_seccion?.[selectedYearId],
          [selectedSection]: { ...currentConfig, ...updates },
        },
      },
    }));
  };

  const handleSave = () => {
    saveEducationCodes.mutate(form, {
      onSuccess: () => toast.success("Códigos guardados"),
      onError: (e: any) => toast.error(e.message || "Error al guardar"),
    });
  };

  // Count configured sections for the selected year
  const configuredCount = selectedYearId
    ? Object.keys(form.menciones_seccion?.[selectedYearId] ?? {}).length
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de cabeceras</CardTitle>
        <CardDescription>Aqui se llenan los codigos utilizados en cada area</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ─── Códigos generales ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="educacion_inicial">Educación Inicial</Label>
            <Input id="educacion_inicial" value={form.educacion_inicial} onChange={set("educacion_inicial")} placeholder="Ej. EI - 01 - 00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigos_educacion_inicial">Códigos Educación Inicial</Label>
            <Input id="codigos_educacion_inicial" value={form.codigos_educacion_inicial} onChange={set("codigos_educacion_inicial")} placeholder="Ej. 00001" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="educacion_primaria">Educación Primaria</Label>
            <Input id="educacion_primaria" value={form.educacion_primaria} onChange={set("educacion_primaria")} placeholder="Ej. DEA - 00 - 00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigos_educacion_primaria">Códigos Educación Primaria</Label>
            <Input id="codigos_educacion_primaria" value={form.codigos_educacion_primaria} onChange={set("codigos_educacion_primaria")} placeholder="Ej. 00002" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="educacion_media_general">Educación Media General</Label>
            <Input id="educacion_media_general" value={form.educacion_media_general} onChange={set("educacion_media_general")} placeholder="Ej. EMG CT 00000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="educacion_media_tecnica">Educación Media Técnica</Label>
            <Input id="educacion_media_tecnica" value={form.educacion_media_tecnica} onChange={set("educacion_media_tecnica")} placeholder="Ej. EMT 00000" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mencion_media_general" className="text-destructive font-medium">
            Educación Media General Mencion En:
          </Label>
          <Textarea
            id="mencion_media_general"
            value={form.mencion_media_general}
            onChange={set("mencion_media_general")}
            placeholder="Ej. CIENCIAS NATURALES"
            className="resize-none"
            rows={2}
          />
        </div>

        <Separator />

        {/* ─── Menciones por año y sección ─── */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Selección del tipo de Mención para la Educación Media General:</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              La mención puede variar por año escolar. Selecciona el año y luego la sección a configurar.
            </p>
          </div>

          {/* Year selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
            <Label>Año Escolar</Label>
            <Select value={selectedYearId} onValueChange={(v) => { setSelectedYearId(v); setSelectedSection(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un año escolar..." />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.year_range}
                    {y.is_active && (
                      <span className="ml-2 text-xs text-primary font-medium">(Activo)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section selector */}
          {selectedYearId && (
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Seleccione la sección</Label>
                {configuredCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {configuredCount} configurada{configuredCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  {sectionsLoading
                    ? <span className="text-muted-foreground text-sm">Cargando secciones...</span>
                    : <SelectValue placeholder="Seleccione una sección..." />
                  }
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => {
                    const hasConfig = !!form.menciones_seccion?.[selectedYearId]?.[s.id];
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          {GRADE_LABELS[s.grade_level] ?? s.grade_level} Sección: {s.name}
                          {hasConfig && <span className="text-xs text-primary">•</span>}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Config panel for selected year + section */}
          {selectedYearId && selectedSection && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Codigo</Label>
                <Select
                  value={currentConfig.tipo}
                  onValueChange={(v) => updateSeccionConfig({ tipo: v as SeccionMencionConfig["tipo"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="con_mencion">
                      {form.codigo_mencion || "31060"} (Con Mención)
                    </SelectItem>
                    <SelectItem value="sin_mencion">
                      {form.codigo_titulo || "31059"} (Sin Mención)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentConfig.tipo === "con_mencion" && (
                <div className="space-y-1.5">
                  <Label className="text-primary">Mención en:</Label>
                  <Input
                    value={currentConfig.mencion_texto}
                    onChange={(e) => updateSeccionConfig({ mencion_texto: e.target.value })}
                    placeholder="Ej. CIENCIAS NATURALES"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-start pt-1">
          <Button onClick={handleSave} disabled={saveEducationCodes.isPending}>
            {saveEducationCodes.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
