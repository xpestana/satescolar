import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSchoolId } from "@/hooks/useSchoolId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Baby, BookOpen, GraduationCap, Plus, Trash2, Settings2 } from "lucide-react";
import { PrimaryIndicatorsModal } from "@/components/grades/PrimaryIndicatorsModal";

interface Scale {
  id: string;
  abbreviation: string;
  description: string;
  display_order: number;
}

export default function GradesSettings() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const queryClient = useQueryClient();
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [newAbbr, setNewAbbr] = useState("");
  const [newScaleDesc, setNewScaleDesc] = useState("");

  // Grades config
  const { data: config, isLoading } = useQuery({
    queryKey: ["grades-config", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data, error } = await supabase
        .from("grades_config")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Scales
  const { data: scales = [] } = useQuery({
    queryKey: ["primary-scales", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("primary_grading_scales")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data as Scale[];
    },
    enabled: !!schoolId,
  });

  const upsertConfig = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!schoolId) throw new Error("No school");
      if (config) {
        const { error } = await supabase
          .from("grades_config")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("school_id", schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("grades_config")
          .insert({ school_id: schoolId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-config", schoolId] });
      toast.success("Configuración guardada");
    },
    onError: () => toast.error("Error al guardar"),
  });

  const addScale = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");
      const maxOrder = scales.length > 0 ? Math.max(...scales.map((s) => s.display_order)) + 1 : 0;
      const { error } = await supabase.from("primary_grading_scales").insert({
        school_id: schoolId,
        abbreviation: newAbbr.trim(),
        description: newScaleDesc.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["primary-scales", schoolId] });
      setNewAbbr("");
      setNewScaleDesc("");
      toast.success("Escala agregada");
    },
    onError: () => toast.error("Error al agregar escala"),
  });

  const deleteScale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("primary_grading_scales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["primary-scales", schoolId] });
      toast.success("Escala eliminada");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const usePercentage = config?.use_percentage_plan ?? false;
  const reportType = (config as any)?.primary_report_type ?? "descriptive";

  return (
    <DashboardLayout>
      <PageHeader title="Ajustes de Notas" breadcrumbs={[{ label: "Gestión del Colegio" }, { label: "Ajustes de Notas" }]} />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Preescolar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Preescolar</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Maternal, Inicial (I, II, III nivel)</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Sin opciones configurables por ahora.</p>
          </CardContent>
        </Card>

        {/* Primaria */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Primaria</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">1° a 6° grado</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Report type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de boleta</Label>
              <RadioGroup
                value={reportType}
                onValueChange={(val) => upsertConfig.mutate({ primary_report_type: val })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="descriptive" id="descriptive" />
                  <Label htmlFor="descriptive" className="font-normal text-sm">Descriptiva</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="indicators" id="indicators" />
                  <Label htmlFor="indicators" className="font-normal text-sm">Por Indicadores</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Indicators button */}
            {reportType === "indicators" && schoolId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIndicatorsOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Gestionar Indicadores
              </Button>
            )}

            {/* Scales */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Escalas de calificación</Label>

              {scales.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold min-w-[40px]">{s.abbreviation}</span>
                  <span className="flex-1 text-muted-foreground truncate">{s.description}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteScale.mutate(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  placeholder="Sigla"
                  value={newAbbr}
                  onChange={(e) => setNewAbbr(e.target.value)}
                  className="w-20"
                />
                <Input
                  placeholder="Descripción"
                  value={newScaleDesc}
                  onChange={(e) => setNewScaleDesc(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={() => addScale.mutate()}
                  disabled={!newAbbr.trim() || !newScaleDesc.trim() || addScale.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Secundaria */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Secundaria</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">1° a 5° año (Media General / Técnica)</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5 flex-1 mr-3">
                <Label htmlFor="percentage-toggle" className="text-sm font-medium">
                  Plan de evaluación con porcentaje
                </Label>
                <p className="text-xs text-muted-foreground">
                  {usePercentage
                    ? "Las evaluaciones tendrán porcentaje asignado."
                    : "Las evaluaciones no usarán porcentaje."}
                </p>
              </div>
              <Switch
                id="percentage-toggle"
                checked={usePercentage}
                onCheckedChange={(checked) => upsertConfig.mutate({ use_percentage_plan: checked })}
                disabled={upsertConfig.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {schoolId && (
        <PrimaryIndicatorsModal
          open={indicatorsOpen}
          onOpenChange={setIndicatorsOpen}
          schoolId={schoolId}
        />
      )}
    </DashboardLayout>
  );
}
