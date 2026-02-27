import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSchoolId } from "@/hooks/useSchoolId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan de Evaluación en Secundaria</CardTitle>
          <CardDescription>
            Define si el colegio utilizará plan de evaluación con porcentaje o sin porcentaje para los niveles de secundaria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="percentage-toggle" className="text-base font-medium">
                Usar plan de evaluación con porcentaje
              </Label>
              <p className="text-sm text-muted-foreground">
                {usePercentage
                  ? "Activado: las evaluaciones en secundaria tendrán un porcentaje asignado."
                  : "Desactivado: las evaluaciones en secundaria no usarán porcentaje."}
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
    </DashboardLayout>
  );
}
