import { useState, useEffect, useRef } from "react";
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
import { Info, Plus, Trash2, ChevronDown, Eye, Star, FileDown, Loader2 } from "lucide-react";
import { downloadPlanillaInscripcion } from "@/lib/export-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ENROLLMENT_CUSTOM_FIELDS } from "@/lib/enrollment-completeness";
import GeneralConfigTab from "@/components/planilla/GeneralConfigTab";

interface FieldConfig {
  id?: string;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tableHeaderBg, setTableHeaderBg] = useState("#2980b9");
  const [tableHeaderText, setTableHeaderText] = useState("#ffffff");
  const [planillaTitle, setPlanillaTitle] = useState("PLANILLA");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const modalDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generalConfigDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (modalDebounceTimer.current) clearTimeout(modalDebounceTimer.current);
      if (generalConfigDebounceTimer.current) clearTimeout(generalConfigDebounceTimer.current);
    };
  }, []);

  const triggerSaved = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

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
        id: existing?.id,
        field_name: ff.field_name,
        field_label: ff.field_label,
        is_visible: existing ? existing.is_visible : idx < 7,
        display_order: existing ? existing.display_order : idx,
      };
    });
    setFields(merged);
  }, [formFields, existingConfig]);

  // Sync colors and title from DB config
  useEffect(() => {
    if (planillaConfig?.header_config) {
      if (planillaConfig.header_config.table_header_bg) setTableHeaderBg(planillaConfig.header_config.table_header_bg);
      if (planillaConfig.header_config.table_header_text) setTableHeaderText(planillaConfig.header_config.table_header_text);
    }
    if (planillaConfig?.planilla_title) setPlanillaTitle(planillaConfig.planilla_title);
  }, [planillaConfig]);

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

  // Modal auto-save (debounced delete+insert)
  const saveModalMutation = useMutation({
    mutationFn: async (currentFields: FieldConfig[]) => {
      if (!schoolId) throw new Error("No school");
      await supabase.from("enrollment_display_config").delete().eq("school_id", schoolId);
      const rows = currentFields.map((f, idx) => ({
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
      triggerSaved();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración del modal." });
    },
  });

  const debouncedSaveModal = (updatedFields: FieldConfig[]) => {
    if (modalDebounceTimer.current) clearTimeout(modalDebounceTimer.current);
    modalDebounceTimer.current = setTimeout(() => {
      setSaveStatus('saving');
      saveModalMutation.mutate(updatedFields);
    }, 600);
  };

  const toggleField = (fieldName: string) => {
    setFields(prev => {
      const updated = prev.map(f =>
        f.field_name === fieldName ? { ...f, is_visible: !f.is_visible } : f
      );
      debouncedSaveModal(updated);
      return updated;
    });
  };

  // Planilla helpers
  const addSection = () => {
    setPlanillaSections(prev => [
      ...prev,
      { title: "", field_names: [], display_order: prev.length, section_type: newSectionType, section_text: "", page_break_before: false },
    ]);
  };

  const savePlanillaSection = async (section: PlanillaSection): Promise<string | null> => {
    if (!schoolId || !section.title.trim()) return null;
    setSaveStatus('saving');
    try {
      if (section.id) {
        const { error } = await supabase
          .from("enrollment_planilla_sections")
          .update({
            title: section.title.trim(),
            field_names: section.field_names,
            section_type: section.section_type,
            section_text: section.section_text,
            page_break_before: section.page_break_before,
            display_order: section.display_order,
          } as any)
          .eq("id", section.id);
        if (error) throw error;
        triggerSaved();
        return section.id;
      } else {
        const { data, error } = await supabase
          .from("enrollment_planilla_sections")
          .insert({
            school_id: schoolId,
            title: section.title.trim(),
            field_names: section.field_names,
            section_type: section.section_type,
            section_text: section.section_text,
            page_break_before: section.page_break_before,
            display_order: section.display_order,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        triggerSaved();
        return data.id;
      }
    } catch {
      setSaveStatus('error');
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la sección." });
      return null;
    }
  };

  const deletePlanillaSection = async (section: PlanillaSection) => {
    if (!section.id || !schoolId) return;
    setSaveStatus('saving');
    try {
      const { error } = await supabase
        .from("enrollment_planilla_sections")
        .delete()
        .eq("id", section.id);
      if (error) throw error;
      triggerSaved();
    } catch {
      setSaveStatus('error');
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la sección." });
    }
  };

  const removeSection = async (index: number) => {
    const section = planillaSections[index];
    await deletePlanillaSection(section);
    setPlanillaSections(prev => prev.filter((_, i) => i !== index));
  };

  const updateSectionTitle = (index: number, title: string) => {
    setPlanillaSections(prev => prev.map((s, i) => i === index ? { ...s, title } : s));
  };

  const updateSectionText = (index: number, section_text: string) => {
    setPlanillaSections(prev => prev.map((s, i) => i === index ? { ...s, section_text } : s));
  };

  const togglePageBreak = (index: number) => {
    setPlanillaSections(prev => {
      const updated = prev.map((s, i) => i === index ? { ...s, page_break_before: !s.page_break_before } : s);
      const updatedSection = updated[index];
      if (updatedSection.id) savePlanillaSection(updatedSection);
      return updated;
    });
  };

  const toggleSectionField = (sectionIndex: number, fieldName: string) => {
    setPlanillaSections(prev => {
      const updated = prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const has = s.field_names.includes(fieldName);
        const isFechaNac = fieldName.endsWith(":fecha_nacimiento");
        const ageKey = fieldName.replace(":fecha_nacimiento", ":_edad");
        let newFieldNames: string[];
        if (has) {
          newFieldNames = s.field_names.filter(f => f !== fieldName);
          if (isFechaNac) newFieldNames = newFieldNames.filter(f => f !== ageKey);
        } else {
          newFieldNames = [...s.field_names, fieldName];
          if (isFechaNac && !newFieldNames.includes(ageKey)) newFieldNames.push(ageKey);
        }
        return { ...s, field_names: newFieldNames };
      });
      const updatedSection = updated[sectionIndex];
      if (updatedSection.id) savePlanillaSection(updatedSection);
      return updated;
    });
  };

  const saveGeneralConfig = async (bg: string, text: string, title: string) => {
    if (!schoolId) return;
    setSaveStatus('saving');
    try {
      const currentHeaderConfig = planillaConfig?.header_config || {};
      const payload = {
        school_id: schoolId,
        header_config: { ...currentHeaderConfig, table_header_bg: bg, table_header_text: text },
        footer_config: planillaConfig?.footer_config || {},
        signature_lines: planillaConfig?.signature_lines || ["Firma del Representante", "Firma del Director(a)"],
        planilla_title: title,
      };
      if (planillaConfig) {
        await supabase.from("planilla_general_config" as any).update(payload as any).eq("school_id", schoolId);
      } else {
        await supabase.from("planilla_general_config" as any).insert(payload as any);
      }
      queryClient.invalidateQueries({ queryKey: ["planilla-general-config"] });
      triggerSaved();
    } catch {
      setSaveStatus('error');
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración." });
    }
  };

  const debouncedSaveGeneralConfig = (bg: string, text: string, title: string) => {
    if (generalConfigDebounceTimer.current) clearTimeout(generalConfigDebounceTimer.current);
    generalConfigDebounceTimer.current = setTimeout(() => saveGeneralConfig(bg, text, title), 800);
  };


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
        generalConfig: {
          ...(planillaConfig || {}),
          header_config: { ...(planillaConfig?.header_config || {}), table_header_bg: tableHeaderBg, table_header_text: tableHeaderText },
          planilla_title: planillaTitle,
        },
        schoolYear: "Vista Previa",
        formFields: [...(studentFields as any[]), ...(repFields as any[])],
      });
    } finally {
      setDownloading(false);
    }
  };

  // Regenerate PDF preview whenever sections or config change
  useEffect(() => {
    const hasSections = planillaSections.some(s => s.field_names.length > 0 || s.section_type === 'text');
    if (!schoolFull || !hasSections) {
      setPreviewUrl(null);
      return;
    }
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const blob = await downloadPlanillaInscripcion(
          {
            student: { form_data: {} },
            representative: { form_data: {} },
            family: null,
            school: schoolFull,
            schoolGeo: (schoolFull as any).geo || {},
            sections: planillaSections.map(s => ({
              title: s.title,
              field_names: s.field_names,
              section_type: s.section_type,
              section_text: s.section_text,
              page_break_before: s.page_break_before,
            })),
            generalConfig: {
              ...(planillaConfig || {}),
              header_config: { ...(planillaConfig?.header_config || {}), table_header_bg: tableHeaderBg, table_header_text: tableHeaderText },
          planilla_title: planillaTitle,
            },
            schoolYear: "Vista Previa",
            formFields: [...(studentFields as any[]), ...(repFields as any[])],
          },
          { returnBlob: true }
        );
        if (blob) {
          const url = URL.createObjectURL(blob as Blob);
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } catch {
        // silent — preview is best-effort
      } finally {
        setPreviewLoading(false);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [planillaSections, planillaConfig, schoolFull, studentFields, repFields, tableHeaderBg, tableHeaderText, planillaTitle]);

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

      {saveStatus !== 'idle' && (
        <div className="flex justify-end mb-2">
          <span className={`text-xs font-medium ${
            saveStatus === 'saved' ? 'text-green-600' :
            saveStatus === 'saving' ? 'text-muted-foreground' :
            'text-destructive'
          }`}>
            {saveStatus === 'saved' ? '✓ Guardado' :
             saveStatus === 'saving' ? 'Guardando...' : 'Error al guardar'}
          </span>
        </div>
      )}

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
            <CardHeader>
              <CardTitle className="text-lg">Campos visibles en el modal</CardTitle>
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
              </div>
            </CardHeader>
            <CardContent>
              {/* Table header colors + title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer">
                  <span className="text-sm">Color de fondo del encabezado</span>
                  <input
                    type="color"
                    value={tableHeaderBg}
                    onChange={e => { setTableHeaderBg(e.target.value); debouncedSaveGeneralConfig(e.target.value, tableHeaderText, planillaTitle); }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0.5 bg-transparent"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer">
                  <span className="text-sm">Color del texto del encabezado</span>
                  <input
                    type="color"
                    value={tableHeaderText}
                    onChange={e => { setTableHeaderText(e.target.value); debouncedSaveGeneralConfig(tableHeaderBg, e.target.value, planillaTitle); }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0.5 bg-transparent"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border mb-6">
                <span className="text-sm shrink-0 mr-4">Título de la planilla</span>
                <Input
                  value={planillaTitle}
                  onChange={e => setPlanillaTitle(e.target.value)}
                  onBlur={() => saveGeneralConfig(tableHeaderBg, tableHeaderText, planillaTitle)}
                  placeholder="PLANILLA"
                  className="max-w-xs text-right"
                />
              </div>

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
                        onBlur={async () => {
                          const sec = planillaSections[sectionIdx];
                          if (!sec.title.trim()) return;
                          const newId = await savePlanillaSection(sec);
                          if (newId && !sec.id) {
                            setPlanillaSections(prev =>
                              prev.map((s, i) => i === sectionIdx ? { ...s, id: newId } : s)
                            );
                          }
                        }}
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
                              onClick={(e) => e.stopPropagation()}
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
                              onBlur={() => {
                                const sec = planillaSections[sectionIdx];
                                if (sec.id) savePlanillaSection(sec);
                              }}
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

          {/* Preview PDF */}
          {(previewUrl || previewLoading) && (
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
              <CardContent className="p-0">
                {previewLoading && !previewUrl && (
                  <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Generando previsualización...</span>
                  </div>
                )}
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    title="Previsualización Planilla"
                    className="w-full border-0 rounded-b-lg"
                    style={{ height: "850px" }}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
