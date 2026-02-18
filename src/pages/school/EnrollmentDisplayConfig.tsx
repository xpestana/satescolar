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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Save, Info, Plus, Trash2, ChevronDown, Eye } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  const { data: studentFields = [] } = useQuery({
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

  // Fetch representative form fields
  const { data: repFields = [] } = useQuery({
    queryKey: ["representative-form-fields-all", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label, field_order")
        .eq("school_id", schoolId)
        .eq("form_type", "representative")
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Static family fields
  const familyFields = [
    { field_name: "email", field_label: "Correo Electrónico" },
    { field_name: "father_last_name", field_label: "Apellido del Padre" },
    { field_name: "mother_last_name", field_label: "Apellido de la Madre" },
    { field_name: "contact_phone", field_label: "Teléfono de Contacto" },
    { field_name: "additional_phone", field_label: "Teléfono Adicional" },
    { field_name: "emergency_contact", field_label: "Contacto de Emergencia" },
    { field_name: "address", field_label: "Dirección" },
    { field_name: "housing_type", field_label: "Tipo de Vivienda" },
    { field_name: "housing_sector", field_label: "Sector" },
    { field_name: "housing_details", field_label: "Detalles de Vivienda" },
    { field_name: "property_ownership", field_label: "Tenencia de Vivienda" },
    { field_name: "monthly_housing_payment", field_label: "Pago Mensual Vivienda" },
    { field_name: "rooms_count", field_label: "Cantidad de Habitaciones" },
    { field_name: "monthly_income", field_label: "Ingreso Mensual" },
    { field_name: "income_contributor", field_label: "Contribuyente de Ingresos" },
    { field_name: "dependents_count", field_label: "Cantidad de Dependientes" },
    { field_name: "parents_marital_status", field_label: "Estado Civil de los Padres" },
    { field_name: "religion", field_label: "Religión" },
    { field_name: "transport_method", field_label: "Medio de Transporte" },
    { field_name: "transport_companion", field_label: "Acompañante de Transporte" },
  ];

  // Combined form fields for modal tab (student only)
  const formFields = studentFields;

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
                  <Collapsible key={sectionIdx} defaultOpen={false} className="border rounded-lg overflow-hidden">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 p-4 bg-muted/30">
                      <span className="text-sm font-semibold text-muted-foreground w-6">
                        {sectionIdx + 1}.
                      </span>
                      <Input
                        value={section.title}
                        onChange={(e) => updateSectionTitle(sectionIdx, e.target.value)}
                        placeholder="Título de la sección (ej: Datos Básicos)"
                        className="flex-1 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {section.field_names.length} campos
                      </span>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSection(sectionIdx)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <CollapsibleContent>
                      <div className="p-4 border-t space-y-4">
                        {[
                          { key: "student", label: "Estudiante", fields: studentFields },
                          { key: "representative", label: "Representante", fields: repFields },
                          { key: "family", label: "Familia", fields: familyFields },
                        ].map(group => (
                          <Collapsible key={group.key} defaultOpen={false} className="border rounded-md">
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                                <span>{group.label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {group.fields.filter(f => section.field_names.includes(`${group.key}:${f.field_name}`)).length} sel.
                                  </span>
                                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 pt-0">
                                {group.fields.map(ff => {
                                  const prefixed = `${group.key}:${ff.field_name}`;
                                  const isSelected = section.field_names.includes(prefixed);
                                  return (
                                    <label
                                      key={prefixed}
                                      className="flex items-center justify-between p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                      <span className="text-sm">{ff.field_label}</span>
                                      <Switch
                                        checked={isSelected}
                                        onCheckedChange={() => toggleSectionField(sectionIdx, prefixed)}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {planillaSections.some(s => s.field_names.length > 0) && (
            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center gap-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Previsualización de la Planilla</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  {planillaSections.filter(s => s.field_names.length > 0).map((section, idx) => {
                    const resolveLabel = (prefixed: string) => {
                      const [type, name] = prefixed.split(":");
                      if (type === "student") return studentFields.find(f => f.field_name === name)?.field_label || name;
                      if (type === "representative") return repFields.find(f => f.field_name === name)?.field_label || name;
                      if (type === "family") return familyFields.find(f => f.field_name === name)?.field_label || name;
                      return name;
                    };
                    const labels = section.field_names.map(resolveLabel);
                    // Build rows of 4 columns
                    const rows: string[][] = [];
                    for (let i = 0; i < labels.length; i += 4) {
                      rows.push(labels.slice(i, i + 4));
                    }
                    return (
                      <div key={idx}>
                        {idx > 0 && <Separator />}
                        <div className="bg-muted/50 px-4 py-2 border-b">
                          <h4 className="text-sm font-bold text-center uppercase tracking-wide">
                            {section.title || "Sin título"}
                          </h4>
                        </div>
                        <div className="divide-y">
                          {rows.map((row, rIdx) => (
                            <div key={rIdx} className="grid grid-cols-4 divide-x">
                              {row.map((label, cIdx) => (
                                <div key={cIdx} className="px-3 py-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</p>
                                  <p className="text-xs text-muted-foreground/50 mt-0.5 italic">—</p>
                                </div>
                              ))}
                              {/* Fill empty cols */}
                              {Array.from({ length: 4 - row.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="px-3 py-2" />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
