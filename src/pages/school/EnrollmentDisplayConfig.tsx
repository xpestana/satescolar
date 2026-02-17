import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Save, Info } from "lucide-react";

interface FieldConfig {
  field_name: string;
  field_label: string;
  is_visible: boolean;
  display_order: number;
}

export default function EnrollmentDisplayConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolId();
  const [fields, setFields] = useState<FieldConfig[]>([]);

  // Fetch student form fields
  const { data: formFields = [] } = useQuery({
    queryKey: ["student-form-fields-all", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label, field_order")
        .eq("school_id", schoolId)
        .eq("form_type", "student")
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch existing config
  const { data: existingConfig = [] } = useQuery({
    queryKey: ["enrollment-display-config", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("enrollment_display_config")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Build fields list from form fields + existing config
  useEffect(() => {
    if (formFields.length === 0) return;

    const configMap = new Map(existingConfig.map(c => [c.field_name, c]));

    const merged = formFields.map((ff, idx) => {
      const existing = configMap.get(ff.field_name);
      return {
        field_name: ff.field_name,
        field_label: ff.field_label,
        is_visible: existing ? existing.is_visible : idx < 7, // Default: first 7 visible
        display_order: existing ? existing.display_order : idx,
      };
    });

    setFields(merged);
  }, [formFields, existingConfig]);

  const toggleField = (fieldName: string) => {
    setFields(prev => prev.map(f =>
      f.field_name === fieldName ? { ...f, is_visible: !f.is_visible } : f
    ));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");

      // Delete existing config and re-insert
      await supabase
        .from("enrollment_display_config")
        .delete()
        .eq("school_id", schoolId);

      const rows = fields.map((f, idx) => ({
        school_id: schoolId,
        field_name: f.field_name,
        field_label: f.field_label,
        is_visible: f.is_visible,
        display_order: idx,
      }));

      const { error } = await supabase
        .from("enrollment_display_config")
        .insert(rows);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-display-config"] });
      toast({ title: "Configuración guardada", description: "Los campos visibles del modal de inscripción han sido actualizados." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración." });
    },
  });

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Ajustes" },
    { label: "Campos de Inscripción" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Campos del Modal de Inscripción" breadcrumbs={breadcrumbs} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Configurar campos visibles</CardTitle>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Selecciona los campos del estudiante que deseas mostrar en el modal de inscripción. Estos datos se mostrarán como información de referencia al inscribir.
            </p>
          </div>

          <div className="space-y-3">
            {fields.map(field => (
              <div key={field.field_name} className="flex items-center justify-between p-3 rounded-lg border">
                <Label className="text-sm font-medium cursor-pointer">{field.field_label}</Label>
                <Switch
                  checked={field.is_visible}
                  onCheckedChange={() => toggleField(field.field_name)}
                />
              </div>
            ))}
          </div>

          {fields.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay campos de estudiante configurados. Ve a Ajustes → Formularios para crear campos.
            </p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
