import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useResumenFinalConfig } from "@/hooks/useResumenFinalConfig";
import { useResumenFinalSubjectOverrides } from "@/hooks/useResumenFinalSubjectOverrides";
import {
  fetchResumenFinalDocxData,
  fetchResumenFinalSubjectsPreview,
  fetchResumenFinalSubjectsForEditor,
} from "@/hooks/useResumenFinalDocxData";
import { generateResumenFinalDocx, downloadBlob } from "@/lib/resumen-final-docx";

const ALL_GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal",
  maternal: "Maternal",
  i_nivel: "I Nivel",
  ii_nivel: "II Nivel",
  iii_nivel: "III Nivel",
  "1_grado": "1er Grado",
  "2_grado": "2do Grado",
  "3_grado": "3er Grado",
  "4_grado": "4to Grado",
  "5_grado": "5to Grado",
  "6_grado": "6to Grado",
  "1_ano": "1er Año",
  "2_ano": "2do Año",
  "3_ano": "3er Año",
  "4_ano": "4to Año",
  "5_ano": "5to Año",
  "6_ano": "6to Año",
};

const EMPTY_FORM = {
  tipo_planilla: "31059" as "31059" | "31060",
  observaciones: "",
  nombre_profesor: "",
  cedula_profesor: "",
};

type SubjectEdit = { name: string; abbreviation: string };

export function ResumenFinalTab() {
  const { schoolId } = useSchoolId();
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [downloadKey, setDownloadKey] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [subjectEdits, setSubjectEdits] = useState<Record<string, SubjectEdit>>({});

  // Fetch school years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school-years-resumen", schoolId],
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

  const { sectionParts, isLoading, saveConfig } = useResumenFinalConfig(selectedYearId);

  // Sync form when selection changes
  useEffect(() => {
    if (!selectedKey) return;
    const found = sectionParts.find((sp) => `${sp.section.id}__${sp.parte}` === selectedKey);
    setForm(found?.config ?? EMPTY_FORM);
  }, [selectedKey, sectionParts]);

  // Reset section selection when year changes
  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    setSelectedKey("");
    setDownloadKey("all");
    setForm(EMPTY_FORM);
    setSubjectEdits({});
  };

  // Selected section's subjects (for the override editor)
  const selectedSectionId = selectedKey ? selectedKey.split("__")[0] : "";
  const { data: editorSubjects = [], isLoading: editorSubjectsLoading } = useQuery({
    queryKey: ["resumen-final-editor-subjects", schoolId, selectedYearId, selectedSectionId],
    queryFn: () => fetchResumenFinalSubjectsForEditor(schoolId!, selectedYearId, selectedSectionId),
    enabled: !!schoolId && !!selectedYearId && !!selectedSectionId,
  });

  // Overrides for the current planilla type
  const { overridesMap, saveOverrides } = useResumenFinalSubjectOverrides(
    schoolId ?? null,
    selectedYearId,
    form.tipo_planilla,
  );

  // Sync subject edits when subjects or overrides change (or planilla type changes)
  useEffect(() => {
    if (!editorSubjects.length) return;
    const edits: Record<string, SubjectEdit> = {};
    for (const s of editorSubjects) {
      const ov = overridesMap.get(s.id);
      edits[s.id] = {
        name: ov?.custom_name ?? s.name,
        abbreviation: ov?.custom_abbreviation ?? s.abbreviation,
      };
    }
    setSubjectEdits(edits);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorSubjects, form.tipo_planilla, overridesMap.size]);

  const handleSaveSubjectOverrides = () => {
    if (!schoolId || !selectedYearId || !editorSubjects.length) return;
    const rows = editorSubjects.map((s) => ({
      subject_id: s.id,
      custom_name: subjectEdits[s.id]?.name?.trim() || null,
      custom_abbreviation: subjectEdits[s.id]?.abbreviation?.trim() || null,
    }));
    saveOverrides.mutate(rows, {
      onSuccess: () => toast.success("Nombres de materias guardados"),
      onError: (e: any) => toast.error(e.message || "Error al guardar nombres"),
    });
  };

  const handleDownload = async () => {
    if (!schoolId || !selectedYearId || isGenerating) return;
    setIsGenerating(true);
    try {
      const yearLabel = schoolYears.find(y => y.id === selectedYearId)?.year_range ?? selectedYearId;
      if (downloadKey === "all") {
        const allData = await Promise.all(
          sectionParts.map(sp =>
            fetchResumenFinalDocxData(schoolId, selectedYearId, sp.section.id, sp.parte)
          )
        );
        const results = await generateResumenFinalDocx(allData);
        for (const r of results) {
          const suffix = results.length > 1 ? `_${r.tipoPlanilla}` : "";
          downloadBlob(r.blob, `Resumen_Final_${yearLabel.replace(/\//g, "-")}${suffix}.docx`);
        }
      } else {
        const [sectionId, parteStr] = downloadKey.split("__");
        const parte = parseInt(parteStr, 10);
        const sp = sectionParts.find(s => s.section.id === sectionId && s.parte === parte);
        const data = await fetchResumenFinalDocxData(schoolId, selectedYearId, sectionId, parte);
        const gradeLabel = ALL_GRADE_LABELS[sp?.section.grade_level ?? ""] ?? sp?.section.grade_level ?? "";
        const filename = `Resumen_Final_${gradeLabel}_${sp?.section.name ?? "Sec"}_P${parte}.docx`.replace(/\s+/g, "_");
        const results = await generateResumenFinalDocx([data]);
        downloadBlob(results[0].blob, filename);
      }
      toast.success("Planilla generada y descargada");
    } catch (e: any) {
      toast.error(`Error al generar: ${e.message ?? "Error desconocido"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!selectedKey || !schoolId || !selectedYearId) return;
    const [sectionId, parteStr] = selectedKey.split("__");
    const parte = parseInt(parteStr, 10);

    saveConfig.mutate(
      { school_id: schoolId, school_year_id: selectedYearId, section_id: sectionId, parte, ...form },
      {
        onSuccess: () => toast.success("Configuración guardada"),
        onError: (e: any) => toast.error(e.message || "Error al guardar"),
      }
    );
  };

  const selectedPart = sectionParts.find((sp) => `${sp.section.id}__${sp.parte}` === selectedKey);
  const configuredCount = sectionParts.filter((sp) => sp.config !== null).length;

  const previewSectionId =
    downloadKey !== "all" ? downloadKey.split("__")[0] : sectionParts[0]?.section.id ?? "";

  const { data: subjectsPreview, isLoading: previewLoading } = useQuery({
    queryKey: ["resumen-final-subjects-preview", schoolId, selectedYearId, previewSectionId],
    queryFn: () => fetchResumenFinalSubjectsPreview(schoolId!, selectedYearId, previewSectionId),
    enabled: !!schoolId && !!selectedYearId && !!previewSectionId,
  });

  return (
    <div className="space-y-5">
      {/* Header info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen Final Rendimiento Estudiantil</CardTitle>
          <CardDescription>
            Configura las observaciones, docente y tipo de planilla por sección y parte.
            Las secciones con más de 35 alumnos se dividen automáticamente en partes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Year selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
            <Label>Año Escolar</Label>
            <Select value={selectedYearId} onValueChange={handleYearChange}>
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

          {/* Section + Part selector */}
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
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger>
                  {isLoading
                    ? <span className="text-muted-foreground text-sm">Cargando secciones...</span>
                    : <SelectValue placeholder="Seleccione una sección..." />
                  }
                </SelectTrigger>
                <SelectContent>
                  {sectionParts.length === 0 && !isLoading && (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No hay secciones con alumnos inscritos en este año.
                    </div>
                  )}
                  {sectionParts.map((sp) => {
                    const key = `${sp.section.id}__${sp.parte}`;
                    const label = ALL_GRADE_LABELS[sp.section.grade_level] ?? sp.section.grade_level;
                    const hasConfig = sp.config !== null;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          {label} Sección: {sp.section.name}
                          {sp.totalParts > 1 && ` parte ${sp.parte}`}
                          {hasConfig && <span className="text-xs text-primary font-bold">•</span>}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config panel */}
      {selectedKey && selectedPart && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {ALL_GRADE_LABELS[selectedPart.section.grade_level] ?? selectedPart.section.grade_level} Sección:{" "}
                {selectedPart.section.name}
                {selectedPart.totalParts > 1 && ` — parte ${selectedPart.parte}`}
              </CardTitle>
              <Badge variant="outline" className="gap-1 text-xs">
                <Users className="h-3 w-3" />
                {selectedPart.studentCount} alumnos
                {selectedPart.totalParts > 1 && ` (parte ${selectedPart.parte} de ${selectedPart.totalParts})`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Tipo planilla */}
            <div className="space-y-2">
              <Label>Tipo de Planilla</Label>
              <RadioGroup
                value={form.tipo_planilla}
                onValueChange={(v) => setForm((p) => ({ ...p, tipo_planilla: v as "31059" | "31060" }))}
                className="flex gap-6"
              >
                <Label
                  htmlFor="tipo-31059"
                  className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    form.tipo_planilla === "31059" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="31059" id="tipo-31059" />
                  <span className="font-medium">31059</span>
                  <span className="text-xs text-muted-foreground">(Sin Mención)</span>
                </Label>
                <Label
                  htmlFor="tipo-31060"
                  className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    form.tipo_planilla === "31060" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="31060" id="tipo-31060" />
                  <span className="font-medium">31060</span>
                  <span className="text-xs text-muted-foreground">(Con Mención)</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={form.observaciones}
                onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
                placeholder="Observaciones para esta sección..."
                className="resize-none"
                rows={4}
              />
            </div>

            {/* Nombre de Profesor */}
            <div className="space-y-1.5">
              <Label htmlFor="nombre_profesor" className="text-primary">Nombre de Profesor</Label>
              <Input
                id="nombre_profesor"
                value={form.nombre_profesor}
                onChange={(e) => setForm((p) => ({ ...p, nombre_profesor: e.target.value }))}
                placeholder="Ej. GARCÍA RODRÍGUEZ JUAN"
              />
            </div>

            {/* Cédula */}
            <div className="space-y-1.5">
              <Label htmlFor="cedula_profesor" className="text-primary">Cédula de identidad</Label>
              <Input
                id="cedula_profesor"
                value={form.cedula_profesor}
                onChange={(e) => setForm((p) => ({ ...p, cedula_profesor: e.target.value }))}
                placeholder="Ej. V 10.000.000"
              />
            </div>

            <div className="flex justify-start pt-1">
              <Button onClick={handleSave} disabled={saveConfig.isPending}>
                {saveConfig.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Guardar
              </Button>
            </div>

            <Separator />

            {/* Subject name/abbreviation editor */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Nombres de Materias</p>
                <p className="text-xs text-muted-foreground">
                  Los cambios aplican a todas las secciones con planilla {form.tipo_planilla} en este año escolar.
                </p>
              </div>
              {editorSubjectsLoading ? (
                <p className="text-sm text-muted-foreground">Cargando materias…</p>
              ) : editorSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay materias asignadas a esta sección.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nombre</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Sigla</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {editorSubjects.map((s, i) => (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <Input
                              value={subjectEdits[s.id]?.name ?? s.name}
                              onChange={(e) =>
                                setSubjectEdits((prev) => ({
                                  ...prev,
                                  [s.id]: { ...prev[s.id], name: e.target.value },
                                }))
                              }
                              className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              value={subjectEdits[s.id]?.abbreviation ?? s.abbreviation}
                              onChange={(e) =>
                                setSubjectEdits((prev) => ({
                                  ...prev,
                                  [s.id]: { ...prev[s.id], abbreviation: e.target.value },
                                }))
                              }
                              className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 bg-transparent"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editorSubjects.length > 0 && (
                <div className="flex justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSubjectOverrides}
                    disabled={saveOverrides.isPending}
                  >
                    {saveOverrides.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Guardar nombres
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download card — always last */}
      {selectedYearId && sectionParts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              Generar Planilla Word
            </CardTitle>
            <CardDescription>
              Descarga la planilla en formato .docx (Legal/Oficio, Arial 10).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
              <Label>Seleccione qué descargar</Label>
              <Select value={downloadKey} onValueChange={setDownloadKey}>
                <SelectTrigger>
                  {isLoading
                    ? <span className="text-muted-foreground text-sm">Cargando secciones...</span>
                    : <SelectValue />
                  }
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todas las secciones ({sectionParts.length} {sectionParts.length === 1 ? "planilla" : "planillas"})
                  </SelectItem>
                  {sectionParts.map((sp) => {
                    const key = `${sp.section.id}__${sp.parte}`;
                    const label = ALL_GRADE_LABELS[sp.section.grade_level] ?? sp.section.grade_level;
                    return (
                      <SelectItem key={key} value={key}>
                        {label} Sección: {sp.section.name}
                        {sp.totalParts > 1 && ` — parte ${sp.parte} de ${sp.totalParts}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {previewLoading ? (
              <p className="text-sm text-muted-foreground">Cargando materias…</p>
            ) : subjectsPreview && subjectsPreview.count > 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-sm font-medium">
                  Área Común: {subjectsPreview.count} materia{subjectsPreview.count !== 1 ? "s" : ""}
                  {downloadKey === "all" && sectionParts.length > 1 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}(vista de la primera sección; cada sección usa sus propias materias)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {subjectsPreview.abbreviations.map((abbr, i) => (
                    <Badge key={`${abbr}-${i}`} variant="outline" className="font-mono text-xs">
                      {i + 1}. {abbr}
                    </Badge>
                  ))}
                  <Badge variant="secondary" className="font-mono text-xs">
                    {subjectsPreview.count + 1}. GP
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    GRUPO
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay materias registradas para esta sección en el año escolar seleccionado.
              </p>
            )}
            <div className="flex justify-start">
              <Button onClick={handleDownload} disabled={isGenerating || isLoading}>
                {isGenerating
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</>
                  : <><FileDown className="h-4 w-4 mr-2" />Descargar Word</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
