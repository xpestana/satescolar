import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Save, Info, Plus, Trash2, GripVertical } from "lucide-react";

interface FieldConfig {
  field_name: string;
  field_label: string;
  is_visible: boolean;
  display_order: number;
}

interface PlanillaSection {
  id?: string;
  title: string;
  field_names: string[];
  display_order: number;
}

export default function EnrollmentDisplayConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolId();
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [planillaSections, setPlanillaSections] = useState<PlanillaSection[]>([]);

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

  // Fetch existing modal config
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

  // Fetch existing planilla sections
  const { data: existingPlanilla = [] } = useQuery({
    queryKey: ["enrollment-planilla-sections", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("enrollment_planilla_sections")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Build modal fields list
  useEffect(() => {
    if (formFields.length === 0) return;
    const configMap = new Map(existingConfig.map(c => [c.field_name, c]));
    const merged = formFields.map((ff, idx) => {
      const existing = configMap.get(ff.field_name);
      return {
        field_name: ff.field_name,
        field_label: ff.field_label,
        is_visible: existing ? existing.is_visible : idx < 7,
        display_order: existing ? existing.display_order : idx,
      };
    });
    setFields(merged);
  }, [formFields, existingConfig]);

  // Build planilla sections
  useEffect(() => {
    if (existingPlanilla.length > 0) {
      setPlanillaSections(
        existingPlanilla.map(s => ({
          id: s.id,
          title: s.title,
          field_names: Array.isArray(s.field_names) ? (s.field_names as string[]) : [],
          display_order: s.display_order,
        }))
      );
    }
  }, [existingPlanilla]);

  const toggleField = (fieldName: string) => {
    setFields(prev => prev.map(f =>
      f.field_name === fieldName ? { ...f, is_visible: !f.is_visible } : f
    ));
  };

  // Modal save
  const saveModalMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");
      await supabase.from("enrollment_display_config").delete().eq("school_id", schoolId);
      const rows = fields.map((f, idx) => ({
        school_id: schoolId,
        field_name: f.field_name,
        field_label: f.field_label,
        is_visible: f.is_visible,
        display_order: idx,
      }));
      const { error } = await supabase.from("enrollment_display_config").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-display-config"] });
      toast({ title: "Configuración guardada", description: "Campos del modal actualizados." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar." });
    },
  });

  // Planilla helpers
  const addSection = () => {
    setPlanillaSections(prev => [
      ...prev,
      { title: "", field_names: [], display_order: prev.length },
    ]);
  };

  const removeSection = (index: number) => {
    setPlanillaSections(prev => prev.filter((_, i) => i !== index));
  };

  const updateSectionTitle = (index: number, title: string) => {
    setPlanillaSections(prev => prev.map((s, i) => i === index ? { ...s, title } : s));
  };

  const toggleSectionField = (sectionIndex: number, fieldName: string) => {
    setPlanillaSections(prev => prev.map((s, i) => {
      if (i !== sectionIndex) return s;
      const has = s.field_names.includes(fieldName);
      return {
        ...s,
        field_names: has
          ? s.field_names.filter(f => f !== fieldName)
          : [...s.field_names, fieldName],
      };
    }));
  };

  // Planilla save
  const savePlanillaMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");

      // Validate
      const emptyTitle = planillaSections.some(s => !s.title.trim());
      if (emptyTitle) throw new Error("Todas las secciones deben tener un título.");

      // Delete existing and re-insert
      await supabase.from("enrollment_planilla_sections").delete().eq("school_id", schoolId);

      if (planillaSections.length === 0) return;

      const rows = planillaSections.map((s, idx) => ({
        school_id: schoolId,
        title: s.title.trim(),
        field_names: s.field_names,
        display_order: idx,
      }));

      const { error } = await supabase.from("enrollment_planilla_sections").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-planilla-sections"] });
      toast({ title: "Configuración guardada", description: "Secciones de la planilla actualizadas." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo guardar." });
    },
  });

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Ajustes" },
    { label: "Datos para Inscripciones" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Datos para Inscripciones" breadcrumbs={breadcrumbs} />

      <Tabs defaultValue="modal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="modal">Modal de Inscripción</TabsTrigger>
          <TabsTrigger value="planilla">Planilla de Inscripción</TabsTrigger>
        </TabsList>

        {/* TAB 1: Modal Config */}
        <TabsContent value="modal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Campos visibles en el modal</CardTitle>
              <Button onClick={() => saveModalMutation.mutate()} disabled={saveModalMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {saveModalMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Selecciona los campos del estudiante que se mostrarán como referencia al inscribir en el modal.
                </p>
              </div>
              <div className="space-y-3">
                {fields.map(field => (
                  <div key={field.field_name} className="flex items-center justify-between p-3 rounded-lg border">
                    <Label className="text-sm font-medium cursor-pointer">{field.field_label}</Label>
                    <Switch checked={field.is_visible} onCheckedChange={() => toggleField(field.field_name)} />
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
        </TabsContent>

        {/* TAB 2: Planilla Config */}
        <TabsContent value="planilla">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Secciones de la Planilla</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={addSection} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Sección
                </Button>
                <Button onClick={() => savePlanillaMutation.mutate()} disabled={savePlanillaMutation.isPending} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savePlanillaMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Crea secciones con un título y selecciona los campos de estudiante que incluirá cada una. Estas secciones se usarán para generar la planilla de inscripción.
                </p>
              </div>

              {planillaSections.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">No hay secciones configuradas aún.</p>
                  <Button variant="outline" onClick={addSection} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Agregar primera sección
                  </Button>
                </div>
              )}

              <div className="space-y-6">
                {planillaSections.map((section, sectionIdx) => (
                  <div key={sectionIdx} className="border rounded-lg overflow-hidden">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 p-4 bg-muted/30 border-b">
                      <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-semibold text-muted-foreground w-8">
                        {sectionIdx + 1}.
                      </span>
                      <Input
                        value={section.title}
                        onChange={(e) => updateSectionTitle(sectionIdx, e.target.value)}
                        placeholder="Título de la sección (ej: Datos Básicos)"
                        className="flex-1 font-medium"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSection(sectionIdx)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Section Fields */}
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-3">
                        Selecciona los campos a incluir en esta sección ({section.field_names.length} seleccionados)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {formFields.map(ff => {
                          const isSelected = section.field_names.includes(ff.field_name);
                          return (
                            <label
                              key={ff.field_name}
                              className="flex items-center justify-between p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <span className="text-sm">{ff.field_label}</span>
                              <Switch
                                checked={isSelected}
                                onCheckedChange={() => toggleSectionField(sectionIdx, ff.field_name)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
