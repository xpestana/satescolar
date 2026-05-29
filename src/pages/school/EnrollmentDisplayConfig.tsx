import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Save, Info, Plus, Trash2, ChevronDown, Eye, Star, FileDown, Loader2 } from "lucide-react";
import { downloadPlanillaInscripcion } from "@/lib/export-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ENROLLMENT_CUSTOM_FIELDS } from "@/lib/enrollment-completeness";
import GeneralConfigTab from "@/components/planilla/GeneralConfigTab";
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
  section_type: 'fields' | 'text';
  section_text: string;
  page_break_before: boolean;
}

export default function EnrollmentDisplayConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolId();
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [planillaSections, setPlanillaSections] = useState<PlanillaSection[]>([]);
  const [customFieldInput, setCustomFieldInput] = useState<Record<number, string>>({});
  const [newSectionType, setNewSectionType] = useState<'fields' | 'text'>('fields');
  const [downloading, setDownloading] = useState(false);

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
    { field_name: "location_full", field_label: "Ubicación (Estado/Municipio/Ciudad/Parroquia)" },
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

  // Fetch planilla general config
  const { data: planillaConfig } = useQuery({
    queryKey: ["planilla-general-config", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase
        .from("planilla_general_config" as any)
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!schoolId,
  });

  // Fetch school full data with geo
  const { data: schoolFull } = useQuery({
    queryKey: ["school-full-enrollment-config", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data: s } = await supabase.from("schools").select("*").eq("id", schoolId).single();
      if (!s) return null;
      const [stateR, muniR, cityR, parishR] = await Promise.all([
        s.state_id ? supabase.from("states").select("name").eq("id", s.state_id).single() : null,
        s.municipality_id ? supabase.from("municipalities").select("name").eq("id", s.municipality_id).single() : null,
        s.city_id ? supabase.from("cities").select("name").eq("id", s.city_id).single() : null,
        s.parish_id ? supabase.from("parishes").select("name").eq("id", s.parish_id).single() : null,
      ]);
      return {
        ...s,
        geo: {
          state: stateR?.data?.name || "",
          municipality: muniR?.data?.name || "",
          city: cityR?.data?.name || "",
          parish: parishR?.data?.name || "",
        },
      };
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
          section_type: ((s as any).section_type || 'fields') as 'fields' | 'text',
          section_text: (s as any).section_text || '',
          page_break_before: (s as any).page_break_before ?? false,
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
      { title: "", field_names: [], display_order: prev.length, section_type: newSectionType, section_text: "", page_break_before: false },
    ]);
  };

  const removeSection = (index: number) => {
    setPlanillaSections(prev => prev.filter((_, i) => i !== index));
  };

  const updateSectionTitle = (index: number, title: string) => {
    setPlanillaSections(prev => prev.map((s, i) => i === index ? { ...s, title } : s));
  };

  const updateSectionText = (index: number, section_text: string) => {
    setPlanillaSections(prev => prev.map((s, i) => i === index ? { ...s, section_text } : s));
  };

  const togglePageBreak = (index: number) => {
    setPlanillaSections(prev => prev.map((s, i) => i === index ? { ...s, page_break_before: !s.page_break_before } : s));
  };

  const toggleSectionField = (sectionIndex: number, fieldName: string) => {
    setPlanillaSections(prev => prev.map((s, i) => {
      if (i !== sectionIndex) return s;
      const has = s.field_names.includes(fieldName);
      
      // Auto-add/remove "Edad" when toggling fecha_nacimiento
      const isFechaNac = fieldName.endsWith(":fecha_nacimiento");
      const ageKey = fieldName.replace(":fecha_nacimiento", ":_edad");
      
      if (has) {
        let filtered = s.field_names.filter(f => f !== fieldName);
        if (isFechaNac) filtered = filtered.filter(f => f !== ageKey);
        return { ...s, field_names: filtered };
      } else {
        const newFields = [...s.field_names, fieldName];
        if (isFechaNac && !newFields.includes(ageKey)) {
          newFields.push(ageKey);
        }
        return { ...s, field_names: newFields };
      }
    }));
  };

  // Planilla save
  const savePlanillaMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");

      const emptyTitle = planillaSections.some(s => !s.title.trim());
      if (emptyTitle) throw new Error("Todas las secciones deben tener un título.");

      await supabase.from("enrollment_planilla_sections").delete().eq("school_id", schoolId);

      if (planillaSections.length === 0) return;

      const rows = planillaSections.map((s, idx) => ({
        school_id: schoolId,
        title: s.title.trim(),
        field_names: s.field_names,
        display_order: idx,
        section_type: s.section_type,
        section_text: s.section_text,
        page_break_before: s.page_break_before,
      }));

      const { error } = await supabase.from("enrollment_planilla_sections").insert(rows as any);
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

  const handleDownloadPreview = async () => {
    if (!schoolFull) return;
    setDownloading(true);
    try {
      await downloadPlanillaInscripcion({
        student: { form_data: {} },
        representative: { form_data: {} },
        family: null,
        school: schoolFull,
        schoolGeo: (schoolFull as any).geo || {},
        sections: existingPlanilla.map((s: any) => ({
          title: s.title,
          field_names: Array.isArray(s.field_names) ? s.field_names : [],
          section_type: s.section_type || "fields",
          section_text: s.section_text || "",
          page_break_before: s.page_break_before ?? false,
        })),
        generalConfig: planillaConfig,
        schoolYear: "Vista Previa",
        formFields: [...(studentFields as any[]), ...(repFields as any[])],
      });
    } finally {
      setDownloading(false);
    }
  };

  const resolveLabel = (prefixed: string) => {
    const [type, ...rest] = prefixed.split(":");
    const name = rest.join(":");
    if (name === "_edad") return "Edad";
    if (type === "custom") return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (type === "student") return studentFields.find(f => f.field_name === name)?.field_label || name;
    if (type === "representative") return repFields.find(f => f.field_name === name)?.field_label || name;
    if (type === "family") return familyFields.find(f => f.field_name === name)?.field_label || name;
    return name;
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Ajustes" },
    { label: "Configuración de Planillas" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Configuración de Planillas" breadcrumbs={breadcrumbs} />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="general">Modificaciones Generales</TabsTrigger>
          <TabsTrigger value="modal">Modal de Inscripción</TabsTrigger>
          <TabsTrigger value="planilla">Planilla de Inscripción</TabsTrigger>
        </TabsList>

        {/* TAB 0: General Config */}
        <TabsContent value="general">
          <GeneralConfigTab schoolId={schoolId} />
        </TabsContent>

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
              <div className="flex gap-2 items-center">
                <Select value={newSectionType} onValueChange={(v) => setNewSectionType(v as 'fields' | 'text')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fields">Campos de datos</SelectItem>
                    <SelectItem value="text">Bloque de texto</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addSection} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar
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
                  Crea secciones de tipo "Campos de datos" para seleccionar campos, o "Bloque de texto" para contenido libre como observaciones o compromisos.
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
                        placeholder="Título de la sección"
                        className="flex-1 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-muted rounded">
                        {section.section_type === 'text' ? 'Texto' : `${section.field_names.length} campos`}
                      </span>
                      {/* Page break toggle */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <label
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer transition-colors select-none whitespace-nowrap text-xs font-medium ${
                                section.page_break_before
                                  ? "bg-primary/10 border-primary/40 text-primary"
                                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                              }`}
                              onClick={(e) => { e.stopPropagation(); togglePageBreak(sectionIdx); }}
                            >
                              <Switch
                                checked={section.page_break_before}
                                onCheckedChange={() => togglePageBreak(sectionIdx)}
                                className="scale-75"
                                onClick={(e) => e.stopPropagation()}
                              />
                              Nueva página
                            </label>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Esta sección iniciará en una nueva página del PDF</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                        {section.section_type === 'text' ? (
                          /* Text section editor */
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Contenido del bloque de texto</Label>
                            <Textarea
                              value={section.section_text}
                              onChange={(e) => updateSectionText(sectionIdx, e.target.value)}
                              placeholder="Escribe el texto que aparecerá en esta sección de la planilla... (Dejar vacío para un área en blanco)"
                              className="min-h-[120px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              Si se deja vacío, se mostrará un área en blanco para rellenar manualmente.
                            </p>
                          </div>
                        ) : (
                          /* Fields section editor */
                          <>
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

                            {/* Custom fields accordion */}
                            <Collapsible defaultOpen={false} className="border rounded-md">
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                                  <span>Campos personalizados</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {section.field_names.filter(f => f.startsWith("custom:")).length} campos
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                                  </div>
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0 space-y-3">
                                  {/* Quick-add enrollment fields */}
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {[
                                      { key: "custom:tipo_de_estudiante", label: "Tipo de Estudiante" },
                                      { key: "custom:grupo_asignado", label: "Grupo Asignado" },
                                      { key: "custom:fecha_de_inscripcion", label: "Fecha de Inscripción" },
                                    ].filter(ef => !section.field_names.includes(ef.key)).map(ef => (
                                      <Button
                                        key={ef.key}
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                        onClick={() => toggleSectionField(sectionIdx, ef.key)}
                                      >
                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                        {ef.label}
                                      </Button>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <Input
                                      value={customFieldInput[sectionIdx] || ""}
                                      onChange={(e) => setCustomFieldInput(prev => ({ ...prev, [sectionIdx]: e.target.value }))}
                                      placeholder="Nombre del campo (ej: Año a cursar)"
                                      className="flex-1"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const val = (customFieldInput[sectionIdx] || "").trim();
                                          if (!val) return;
                                          const key = `custom:${val.toLowerCase().replace(/\s+/g, "_")}`;
                                          if (!planillaSections[sectionIdx].field_names.includes(key)) {
                                            toggleSectionField(sectionIdx, key);
                                          }
                                          setCustomFieldInput(prev => ({ ...prev, [sectionIdx]: "" }));
                                        }
                                      }}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const val = (customFieldInput[sectionIdx] || "").trim();
                                        if (!val) return;
                                        const key = `custom:${val.toLowerCase().replace(/\s+/g, "_")}`;
                                        if (!planillaSections[sectionIdx].field_names.includes(key)) {
                                          toggleSectionField(sectionIdx, key);
                                        }
                                        setCustomFieldInput(prev => ({ ...prev, [sectionIdx]: "" }));
                                      }}
                                      className="gap-1"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Agregar
                                    </Button>
                                  </div>
                                  {section.field_names.filter(f => f.startsWith("custom:")).length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {section.field_names.filter(f => f.startsWith("custom:")).map(f => {
                                        const label = f.replace("custom:", "").replace(/_/g, " ");
                                        const isEnrollmentField = ENROLLMENT_CUSTOM_FIELDS.includes(f);
                                        return (
                                          <div key={f} className={`flex items-center justify-between p-2.5 rounded-md border ${isEnrollmentField ? "border-amber-300 bg-amber-50/50" : ""}`}>
                                            <div className="flex items-center gap-1.5">
                                              {isEnrollmentField && (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger>
                                                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>Este campo se llena automáticamente al inscribir</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              )}
                                              <span className="text-sm capitalize">{label}</span>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-destructive hover:text-destructive"
                                              onClick={() => toggleSectionField(sectionIdx, f)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {planillaSections.some(s => s.field_names.length > 0 || s.section_type === 'text') && (
            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Previsualización de la Planilla</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPreview}
                  disabled={downloading || !schoolFull}
                  className="gap-2"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  {downloading ? "Generando..." : "Descargar PDF"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white text-foreground">

                  {/* HEADER */}
                  {schoolFull && (
                    <div className="p-3 border-b">
                      <div className="flex items-start justify-between gap-3">
                        {planillaConfig?.header_config?.show_logo !== false && (schoolFull as any).logo_url && (
                          <img src={(schoolFull as any).logo_url} alt="Logo" className="w-12 h-12 object-contain flex-shrink-0 rounded-full border" />
                        )}
                        <div className="flex-1 text-center space-y-0.5">
                          {planillaConfig?.header_config?.show_name !== false && (
                            <p className="text-xs font-bold">{(schoolFull as any).name}</p>
                          )}
                          {(planillaConfig?.header_config?.show_dea_code !== false || planillaConfig?.header_config?.show_statistical_code !== false) && (
                            <p className="text-[9px] text-muted-foreground">
                              {planillaConfig?.header_config?.show_dea_code !== false && `Código DEA: ${(schoolFull as any).dea_code}`}
                              {planillaConfig?.header_config?.show_dea_code !== false && planillaConfig?.header_config?.show_statistical_code !== false && " - "}
                              {planillaConfig?.header_config?.show_statistical_code !== false && `Código Estadístico: ${(schoolFull as any).statistical_code}`}
                            </p>
                          )}
                          {planillaConfig?.header_config?.show_address !== false && (schoolFull as any).address && (
                            <p className="text-[9px] text-muted-foreground">
                              {[(schoolFull as any).address, (schoolFull as any).geo?.municipality, (schoolFull as any).geo?.city, (schoolFull as any).geo?.state].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {(planillaConfig?.header_config?.show_phone !== false || planillaConfig?.header_config?.show_rif !== false) && (
                            <p className="text-[9px] text-muted-foreground">
                              {planillaConfig?.header_config?.show_phone !== false && `Tel: ${(schoolFull as any).phone}`}
                              {planillaConfig?.header_config?.show_phone !== false && planillaConfig?.header_config?.show_rif !== false && "  -  "}
                              {planillaConfig?.header_config?.show_rif !== false && `Rif: ${(schoolFull as any).rif}`}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {planillaConfig?.header_config?.show_representative_photo !== false && (
                            <div className="w-10 h-12 border rounded bg-muted/50 flex items-center justify-center">
                              <span className="text-[7px] text-muted-foreground text-center leading-tight">Foto<br/>Rep.</span>
                            </div>
                          )}
                          {planillaConfig?.header_config?.show_student_photo !== false && (
                            <div className="w-10 h-12 border rounded bg-muted/50 flex items-center justify-center">
                              <span className="text-[7px] text-muted-foreground text-center leading-tight">Foto<br/>Est.</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-center uppercase tracking-wide mt-2">PLANILLA</p>
                    </div>
                  )}

                  {/* SECTIONS */}
                  {planillaSections.filter(s => s.field_names.length > 0 || s.section_type === 'text').map((section, idx) => {
                    if (section.section_type === 'text') {
                      return (
                        <div key={idx}>
                          {section.page_break_before ? (
                            <div className="flex items-center gap-2 px-4 py-1 bg-primary/5 border-y border-primary/20">
                              <span className="text-[9px] font-medium text-primary uppercase tracking-wide">↳ Nueva página en PDF</span>
                            </div>
                          ) : <Separator />}
                          <div className="bg-muted/50 px-4 py-2 border-b">
                            <h4 className="text-sm font-bold text-center uppercase tracking-wide">
                              {section.title || "Sin título"}
                            </h4>
                          </div>
                          <div className="px-4 py-3">
                            {section.section_text ? (
                              <p className="text-xs leading-relaxed whitespace-pre-line">{section.section_text}</p>
                            ) : (
                              <div className="border-b border-dashed border-muted-foreground/30 py-4">
                                <p className="text-xs text-muted-foreground/50 italic text-center">Área para rellenar</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const labels = section.field_names.map(resolveLabel);
                    const rows: string[][] = [];
                    for (let i = 0; i < labels.length; i += 4) {
                      rows.push(labels.slice(i, i + 4));
                    }
                    return (
                      <div key={idx}>
                        {section.page_break_before ? (
                          <div className="flex items-center gap-2 px-4 py-1 bg-primary/5 border-y border-primary/20">
                            <span className="text-[9px] font-medium text-primary uppercase tracking-wide">↳ Nueva página en PDF</span>
                          </div>
                        ) : <Separator />}
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
                              {Array.from({ length: 4 - row.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="px-3 py-2" />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* SIGNATURES */}
                  {planillaConfig?.signature_lines?.length > 0 && (
                    <>
                      <Separator />
                      <div className="p-4">
                        <div className={`grid gap-6 ${planillaConfig.signature_lines.length <= 3 ? `grid-cols-${planillaConfig.signature_lines.length}` : "grid-cols-3"}`}>
                          {planillaConfig.signature_lines.map((sig: string, idx: number) => (
                            <div key={idx} className="text-center">
                              <div className="border-b border-foreground/30 mb-1 h-8" />
                              <p className="text-[9px] text-muted-foreground">{sig}</p>
                              <p className="text-[8px] text-muted-foreground mt-1">C.I.</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* FOOTER */}
                  {planillaConfig?.footer_config && schoolFull && (
                    <>
                      <Separator />
                      <div className="p-3 text-center space-y-0.5">
                        {planillaConfig.footer_config.show_address !== false && (schoolFull as any).address && (
                          <p className="text-[9px] text-muted-foreground">
                            {[(schoolFull as any).address, (schoolFull as any).geo?.municipality, (schoolFull as any).geo?.city, (schoolFull as any).geo?.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {(planillaConfig.footer_config.show_phone !== false || planillaConfig.footer_config.show_rif !== false) && (
                          <p className="text-[9px] text-muted-foreground">
                            {planillaConfig.footer_config.show_phone !== false && `Tel: ${(schoolFull as any).phone}`}
                            {planillaConfig.footer_config.show_phone !== false && planillaConfig.footer_config.show_rif !== false && "  "}
                            {planillaConfig.footer_config.show_rif !== false && `Rif: ${(schoolFull as any).rif}`}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
