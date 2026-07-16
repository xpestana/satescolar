import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, Loader2, Save, User, ChevronDown, ClipboardList, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/utilities/RichTextEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  generatePrimaryDescriptiveHtml,
  DEFAULT_BACHILLERATO_CONFIG,
  type BachilleratoConfig,
  type PrimaryDescriptiveRenderData,
} from "@/lib/bachilleratoTemplate";
import { htmlToPdfBlob } from "@/lib/htmlToPdfDownload";
import { fetchAsBase64, fetchPrimaryBoletaSignatures } from "@/lib/primaryDescriptiveBoleta";

const GRADE_LABELS: Record<string, string> = {
  "1_grado": "1er Grado", "2_grado": "2do Grado", "3_grado": "3er Grado",
  "4_grado": "4to Grado", "5_grado": "5to Grado", "6_grado": "6to Grado",
};

interface PrimaryFinalReportModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  assignmentId: string;
  schoolId: string;
  momento: number;
  gradeLevel: string;
  reportType: "descriptive" | "indicators";
  onSaved?: () => void;
}

export default function PrimaryFinalReportModal({
  open, onClose, studentId, studentName, assignmentId, schoolId,
  momento, gradeLevel, reportType, onSaved,
}: PrimaryFinalReportModalProps) {
  const [descriptiveReport, setDescriptiveReport] = useState("");
  const [indicatorValues, setIndicatorValues] = useState<Record<string, string>>({});
  const [literal, setLiteral] = useState("");
  const [literalNumerico, setLiteralNumerico] = useState("");
  const [absenceCount, setAbsenceCount] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTeacherTab, setActiveTeacherTab] = useState("1");
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [observacionesOpen, setObservacionesOpen] = useState(true);
  const [notasOpen, setNotasOpen] = useState(true);
  const [schoolLogoB64, setSchoolLogoB64] = useState("");
  const [footerLogoB64, setFooterLogoB64] = useState("");

  // Load teacher info from assignment
  const { data: teacherInfo } = useQuery({
    queryKey: ["assignment-teacher", assignmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subject_teacher_assignments")
        .select("teacher_id, teachers(id, document_id, form_data)")
        .eq("id", assignmentId)
        .maybeSingle();
      if (!data || !data.teachers) return null;
      const t = data.teachers as any;
      const fd = t.form_data || {};
      const fullName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
        .filter(Boolean).join(" ");
      return { name: fullName || "Sin nombre", documentId: t.document_id || "—" };
    },
    enabled: open,
  });

  // School info for preview
  const { data: schoolData } = useQuery({
    queryKey: ["school-info-preview", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("schools")
        .select("name, logo_url, address, dea_code, phone")
        .eq("id", schoolId)
        .single();
      return data as any;
    },
    enabled: open,
  });

  // Section + year info for preview
  const { data: assignmentDetail } = useQuery({
    queryKey: ["assignment-section-year", assignmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subject_teacher_assignments")
        .select("section:section_id(id, name, grade_level), school_year:school_year_id(id, year_range)")
        .eq("id", assignmentId)
        .maybeSingle();
      return data as any;
    },
    enabled: open,
  });

  // Boleta template config (colors, fonts, slogan, footer logo, signatures)
  const { data: templateData } = useQuery({
    queryKey: ["boleta-template-primary", schoolId, gradeLevel],
    queryFn: async () => {
      const { data } = await supabase
        .from("boleta_templates" as any)
        .select("config, paper_width_mm, paper_height_mm, applicable_grades")
        .eq("school_id", schoolId)
        .eq("is_active", true);
      const allTemplates = (data ?? []) as any[];
      const primaryTemplates = allTemplates.filter(
        (t) => t.config?.style === "primaria_descriptivo"
      );
      const tpl =
        primaryTemplates.find(
          (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeLevel)
        ) ??
        primaryTemplates.find(
          (t) => !t.applicable_grades || t.applicable_grades.length === 0
        ) ??
        null;
      return tpl as any;
    },
    enabled: open,
  });

  // Student document_id
  const { data: studentDocData } = useQuery({
    queryKey: ["student-docid-preview", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students" as any)
        .select("document_id")
        .eq("id", studentId)
        .maybeSingle();
      return data as any;
    },
    enabled: open,
  });

  // Load existing report
  const { data: existingReport, isLoading: reportLoading } = useQuery({
    queryKey: ["primary-final-report", studentId, assignmentId, momento],
    queryFn: async () => {
      const { data } = await supabase
        .from("primary_final_reports" as any)
        .select("*")
        .eq("student_id", studentId)
        .eq("assignment_id", assignmentId)
        .eq("momento", momento)
        .maybeSingle();
      return data as any;
    },
    enabled: open,
  });

  // Load existing indicator grades
  const { data: existingIndicatorGrades = [], isLoading: indicatorGradesLoading } = useQuery({
    queryKey: ["primary-indicator-grades", studentId, assignmentId, momento],
    queryFn: async () => {
      const { data } = await supabase
        .from("primary_final_indicator_grades" as any)
        .select("*")
        .eq("student_id", studentId)
        .eq("assignment_id", assignmentId)
        .eq("momento", momento);
      return (data as any[]) || [];
    },
    enabled: open && reportType === "indicators",
  });

  // Load teacher grades (evaluation plan items + student grades)
  const { data: planItems = [] } = useQuery({
    queryKey: ["primary-teacher-plan", assignmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluation_plan_items")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("momento")
        .order("display_order");
      return data || [];
    },
    enabled: open,
  });

  const { data: studentGrades = [] } = useQuery({
    queryKey: ["primary-teacher-grades", assignmentId, studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_grades")
        .select("evaluation_plan_item_id, grade_value")
        .eq("assignment_id", assignmentId)
        .eq("student_id", studentId);
      return data || [];
    },
    enabled: open,
  });

  // Map grade_level enum to DB format (e.g. "1_grado" -> "1")
  const dbGradeLevel = gradeLevel.replace("_grado", "");

  // Load indicators and scales for indicators mode
  const { data: areas = [] } = useQuery({
    queryKey: ["primary-areas", schoolId, dbGradeLevel],
    queryFn: async () => {
      const { data } = await supabase
        .from("primary_indicator_areas")
        .select("*, indicators:primary_grade_indicators(id, description, display_order)")
        .eq("school_id", schoolId)
        .eq("grade_level", dbGradeLevel)
        .order("display_order");
      return data || [];
    },
    enabled: open && reportType === "indicators",
  });

  const { data: scales = [] } = useQuery({
    queryKey: ["primary-scales", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("primary_grading_scales")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      return data || [];
    },
    enabled: open && reportType === "indicators",
  });

  // Initialize from existing data
  useEffect(() => {
    if (!open) return;
    if (existingReport) {
      setDescriptiveReport((existingReport as any).descriptive_report || "");
      setLiteral((existingReport as any).literal || "");
      setLiteralNumerico((existingReport as any).literal_numerico != null ? String((existingReport as any).literal_numerico) : "");
      setAbsenceCount((existingReport as any).absence_count || 0);
      setProjectName((existingReport as any).project_name || "");
    } else {
      setDescriptiveReport("");
      setLiteral("");
      setLiteralNumerico("");
      setAbsenceCount(0);
      setProjectName("");
    }
  }, [open, existingReport]);

  useEffect(() => {
    if (!open) return;
    const map: Record<string, string> = {};
    for (const ig of existingIndicatorGrades) {
      if ((ig as any).scale_id) {
        map[(ig as any).indicator_id] = (ig as any).scale_id;
      }
    }
    setIndicatorValues(map);
  }, [open, existingIndicatorGrades]);

  // Fetch school logo as base64 when available
  useEffect(() => {
    const url = (schoolData as any)?.logo_url;
    if (!url) { setSchoolLogoB64(""); return; }
    fetchAsBase64(url).then(setSchoolLogoB64);
  }, [(schoolData as any)?.logo_url]);

  // Fetch footer logo as base64 when template config loads
  useEffect(() => {
    const url = (templateData as any)?.config?.primaria?.footer_logo_url;
    if (!url) { setFooterLogoB64(""); return; }
    fetchAsBase64(url).then(setFooterLogoB64);
  }, [(templateData as any)?.config?.primaria?.footer_logo_url]);

  // Live preview: regenerate PDF 1200ms after any content change
  useEffect(() => {
    if (!open || !schoolData || !assignmentDetail) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewPdfUrl(null);
      }
      return;
    }
    setPreviewLoading(true);
    const controller = { cancelled: false };
    const timer = setTimeout(async () => {
      try {
        // Build template config (same merge logic as primaryDescriptiveBoleta.ts)
        const tpl = templateData as any;
        const cfg: BachilleratoConfig = tpl?.config
          ? {
              ...DEFAULT_BACHILLERATO_CONFIG,
              ...tpl.config,
              sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) },
              primaria: {
                show_footer_logo: false,
                footer_logo_position: "center",
                signatures: [],
                ...(tpl.config?.primaria ?? {}),
                footer_logo_url: footerLogoB64,
              },
            }
          : DEFAULT_BACHILLERATO_CONFIG;
        const paperW: number = tpl?.paper_width_mm ?? 215.9;
        const paperH: number = tpl?.paper_height_mm ?? 279.4;

        const sectionId = (assignmentDetail as any)?.section?.id;
        const yearId = (assignmentDetail as any)?.school_year?.id;
        const signatures = sectionId && yearId
          ? await fetchPrimaryBoletaSignatures(cfg, schoolId, sectionId, yearId)
          : undefined;
        if (controller.cancelled) return;

        const previewData: PrimaryDescriptiveRenderData = {
          school_name: (schoolData as any)?.name ?? "",
          school_logo: schoolLogoB64,
          year_range: (assignmentDetail as any)?.school_year?.year_range ?? "",
          address: (schoolData as any)?.address ?? "",
          dea_code: (schoolData as any)?.dea_code ?? "",
          phone: (schoolData as any)?.phone ?? "",
          literal,
          literal_numerico: literalNumerico,
          student_name: studentName,
          document_id: (studentDocData as any)?.document_id ?? "",
          grade_label: GRADE_LABELS[gradeLevel] ?? gradeLevel,
          section_name: (assignmentDetail as any)?.section?.name ?? "",
          momento,
          main_report: descriptiveReport.trim()
            ? { subject_name: "Informe General", html: descriptiveReport }
            : null,
          especialistas: [],
          signatures,
        };
        const html = generatePrimaryDescriptiveHtml(cfg, previewData, paperW, paperH);
        const blob = await htmlToPdfBlob(html);
        if (controller.cancelled) return;
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewPdfUrl(url);
      } catch {
        // mantener preview anterior si falla
      } finally {
        if (!controller.cancelled) setPreviewLoading(false);
      }
    }, 1200);
    return () => {
      controller.cancelled = true;
      clearTimeout(timer);
      setPreviewLoading(false);
    };
  }, [open, descriptiveReport, literal, literalNumerico, schoolData, assignmentDetail, studentName, momento, gradeLevel, templateData, schoolLogoB64, footerLogoB64, studentDocData]);

  // Revocar blob URL al desmontar
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // Teacher grades grouped by momento
  const teacherGradesByMomento = useMemo(() => {
    const gradesMap: Record<string, string> = {};
    studentGrades.forEach((g: any) => {
      gradesMap[g.evaluation_plan_item_id] = g.grade_value || "";
    });
    const grouped: Record<number, { description: string; grade: string }[]> = { 1: [], 2: [], 3: [] };
    planItems.forEach((pi: any) => {
      if (grouped[pi.momento]) {
        grouped[pi.momento].push({
          description: pi.description,
          grade: gradesMap[pi.id] || "—",
        });
      }
    });
    return grouped;
  }, [planItems, studentGrades]);

  const handleLiteralChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-E]/g, "").slice(0, 1);
    setLiteral(cleaned);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const reportPayload = {
        student_id: studentId,
        assignment_id: assignmentId,
        school_id: schoolId,
        momento,
        descriptive_report: descriptiveReport,
        literal,
        literal_numerico: literalNumerico !== "" ? parseFloat(literalNumerico) : null,
        absence_count: absenceCount,
        project_name: projectName,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("primary_final_reports" as any)
        .upsert(reportPayload as any, { onConflict: "student_id,assignment_id,momento" });

      // Save indicator grades if in indicators mode
      if (reportType === "indicators" && Object.keys(indicatorValues).length > 0) {
        const upserts = Object.entries(indicatorValues)
          .filter(([_, scaleId]) => scaleId)
          .map(([indicatorId, scaleId]) => ({
            student_id: studentId,
            assignment_id: assignmentId,
            school_id: schoolId,
            momento,
            indicator_id: indicatorId,
            scale_id: scaleId,
            updated_at: new Date().toISOString(),
          }));

        if (upserts.length > 0) {
          await supabase
            .from("primary_final_indicator_grades" as any)
            .upsert(upserts as any, { onConflict: "student_id,assignment_id,momento,indicator_id" });
        }
      }

      toast.success("Informe guardado correctamente");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Error al guardar el informe");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = reportLoading || indicatorGradesLoading;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-none h-[96vh] max-h-none flex flex-col p-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Informe — {studentName}
            <Badge variant="outline">Momento {momento === 0 ? "Final" : momento}</Badge>
            <Badge variant="secondary">{reportType === "descriptive" ? "Descriptivo" : "Por Indicadores"}</Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-md p-3 space-y-3">
                <Skeleton className="h-5 w-32" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

            {/* Left column: Informe Descriptivo (top) + Observaciones del Momento (bottom) */}
            <div className="flex flex-col gap-2 min-h-0">

              {/* Top: Informe Descriptivo / Indicadores */}
              <div className={cn(
                "border rounded-md overflow-hidden flex flex-col min-h-0",
                observacionesOpen ? "flex-[7]" : "flex-1"
              )}>
                <div className="px-3 py-2 bg-muted/30 border-b shrink-0">
                  <h3 className="text-sm font-semibold">
                    {reportType === "descriptive" ? "Informe Descriptivo" : "Indicadores"}
                  </h3>
                </div>
                <div className="flex-1 min-h-0 flex flex-col p-3">
                  {reportType === "descriptive" ? (
                    <RichTextEditor
                      value={descriptiveReport}
                      onChange={setDescriptiveReport}
                      placeholder="Redacte el informe descriptivo del estudiante..."
                    />
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-2">
                        {areas.map((area: any) => (
                          <div key={area.id}>
                            <h4 className="text-sm font-semibold text-primary mb-2">{area.name}</h4>
                            <div className="space-y-2">
                              {(area.indicators || [])
                                .sort((a: any, b: any) => a.display_order - b.display_order)
                                .map((ind: any) => (
                                  <div key={ind.id} className="flex items-start gap-2">
                                    <span className="text-xs flex-1 pt-1.5">{ind.description}</span>
                                    <Select
                                      value={indicatorValues[ind.id] || ""}
                                      onValueChange={(v) =>
                                        setIndicatorValues((prev) => ({ ...prev, [ind.id]: v }))
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {scales.map((sc: any) => (
                                          <SelectItem key={sc.id} value={sc.id} className="text-xs">
                                            {sc.abbreviation}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                        {areas.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No hay indicadores configurados para este grado.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              {/* Bottom: Observaciones del Momento (collapsible) */}
              <div className={cn(
                "border rounded-md overflow-hidden flex flex-col min-h-0",
                observacionesOpen ? "flex-[3]" : "shrink-0 h-auto"
              )}>
                <button
                  onClick={() => setObservacionesOpen(!observacionesOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border-b border-blue-500/20 text-blue-700 dark:text-blue-300 transition-colors"
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Observaciones del Momento
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", observacionesOpen && "rotate-180")} />
                </button>
                {observacionesOpen && (
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Literal (A-E)</Label>
                          <Input
                            value={literal}
                            onChange={(e) => handleLiteralChange(e.target.value)}
                            placeholder="A"
                            maxLength={1}
                            className="h-8 text-center font-semibold uppercase"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Literal Numérico</Label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            step={0.01}
                            value={literalNumerico}
                            onChange={(e) => setLiteralNumerico(e.target.value)}
                            placeholder="19"
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Inasistencias</Label>
                        <Input
                          type="number"
                          min={0}
                          value={absenceCount}
                          onChange={(e) => setAbsenceCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nombre del Proyecto</Label>
                        <Input
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="Nombre del proyecto..."
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <User className="h-3 w-3" /> Docente
                        </Label>
                        <Input
                          value={teacherInfo?.name || "—"}
                          readOnly
                          className="h-8 bg-muted/50 cursor-default text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cédula del Docente</Label>
                        <Input
                          value={teacherInfo?.documentId || "—"}
                          readOnly
                          className="h-8 bg-muted/50 cursor-default"
                        />
                      </div>
                      {reportType === "indicators" && (
                        <div className="space-y-1">
                          <Label className="text-xs">Observación Descriptiva</Label>
                          <RichTextEditor
                            value={descriptiveReport}
                            onChange={setDescriptiveReport}
                            placeholder="Observación adicional..."
                            minHeight={120}
                            className="min-h-[160px]"
                          />
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>

            </div>

            {/* Right column: Vista Previa (top) + Notas del Docente (bottom) */}
            <div className="flex flex-col gap-2 min-h-0">

              {/* Top: Vista Previa */}
              <div className={cn(
                "border rounded-md overflow-hidden flex flex-col min-h-0",
                notasOpen ? "flex-[7]" : "flex-1"
              )}>
                <div className="px-3 py-2 bg-muted/30 border-b shrink-0 flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Vista Previa
                  </h3>
                  {previewLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex-1 relative min-h-0 overflow-hidden">
                  {previewPdfUrl ? (
                    <iframe
                      src={previewPdfUrl}
                      className="w-full h-full border-0"
                      title="Vista previa de boleta"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      {previewLoading ? "Generando vista previa..." : "Complete los campos para ver la vista previa"}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom: Notas del Docente (collapsible) */}
              <div className={cn(
                "border rounded-md overflow-hidden flex flex-col min-h-0",
                notasOpen ? "flex-[3]" : "shrink-0 h-auto"
              )}>
                <button
                  onClick={() => setNotasOpen(!notasOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 transition-colors"
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Notas del Docente
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", notasOpen && "rotate-180")} />
                </button>
                {notasOpen && (
                  <Tabs value={activeTeacherTab} onValueChange={setActiveTeacherTab} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="mx-2 mt-2 shrink-0">
                      {[1, 2, 3].map((m) => (
                        <TabsTrigger key={m} value={String(m)} className="text-xs">
                          Momento {m}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {[1, 2, 3].map((m) => (
                      <TabsContent key={m} value={String(m)} className="flex-1 px-3 pb-3 min-h-0">
                        <ScrollArea className="h-full">
                          {teacherGradesByMomento[m]?.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Sin evaluaciones en este momento
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {teacherGradesByMomento[m]?.map((item, idx) => (
                                <div key={idx} className="flex items-start justify-between gap-2 py-1.5 border-b last:border-0">
                                  <span className="text-sm flex-1">{item.description}</span>
                                  <Badge variant="outline" className="shrink-0">{item.grade}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </div>

            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Informe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
