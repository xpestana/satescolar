import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSchoolId } from "@/hooks/useSchoolId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Baby, BookOpen, GraduationCap } from "lucide-react";

export default function GradesSettings() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const queryClient = useQueryClient();

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

  const mutation = useMutation({
    mutationFn: async (usePercentage: boolean) => {
      if (!schoolId) throw new Error("No school");
      if (config) {
        const { error } = await supabase
          .from("grades_config")
          .update({ use_percentage_plan: usePercentage, updated_at: new Date().toISOString() })
          .eq("school_id", schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("grades_config")
          .insert({ school_id: schoolId, use_percentage_plan: usePercentage });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-config", schoolId] });
      toast.success("Configuración guardada");
    },
    onError: () => toast.error("Error al guardar la configuración"),
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
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Sin opciones configurables por ahora.</p>
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
                onCheckedChange={(checked) => mutation.mutate(checked)}
                disabled={mutation.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
