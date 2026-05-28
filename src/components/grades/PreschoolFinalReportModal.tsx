import { useState, useEffect, useMemo } from "react";
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

interface PreschoolFinalReportModalProps {
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

// Map grade_level enum to preschool component level
function mapGradeLevelToPreschoolLevel(gradeLevel: string): string {
  switch (gradeLevel) {
    case "pre_maternal":
    case "maternal":
      return "prematernal";
    case "i_nivel":
      return "1";
    case "ii_nivel":
      return "2";
    case "iii_nivel":
      return "3";
    default:
      return gradeLevel;
  }
}

function buildPreschoolPreviewHtml(opts: {
  schoolName: string;
  yearRange: string;
  studentName: string;
  levelLabel: string;
  sectionName: string;
  literal: string;
  momento: number;
  descriptiveReport: string;
}): string {
  const lapsoLabels: Record<number, string> = { 1: "1er", 2: "2do", 3: "3er" };
  const lapso = lapsoLabels[opts.momento] ?? `${opts.momento}°`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 10pt; margin: 15mm 15mm 15mm 15mm; color: #111; }
  .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 10px; text-align: center; }
  .school { font-size: 13pt; font-weight: 700; color: #1e3a5f; text-transform: uppercase; }
  .year { font-size: 9pt; color: #4b5563; margin-top: 2px; }
  .title { text-align: center; font-size: 11pt; font-weight: 700; text-decoration: underline; text-transform: uppercase; margin: 10px 0; }
  .student-row { display: flex; gap: 20px; margin-bottom: 10px; font-size: 9.5pt; }
  .student-row span { font-weight: 600; }
  .report-body { font-size: 10pt; line-height: 1.7; text-align: justify; }
  .footer-literal { margin-top: 16px; display: flex; gap: 24px; font-size: 9.5pt; }
  .footer-literal span { font-weight: 600; }
</style></head><body>
<div class="header">
  <div class="school">${esc(opts.schoolName)}</div>
  <div class="year">AÑO ESCOLAR ${esc(opts.yearRange)}</div>
</div>
<div class="title">INFORME DESCRIPTIVO DEL ${lapso} LAPSO</div>
<div class="student-row">
  <div>Alumno(a): <span>${esc(opts.studentName)}</span></div>
  <div>Nivel: <span>${esc(opts.levelLabel)}</span></div>
  <div>Sección: <span>${esc(opts.sectionName)}</span></div>
</div>
<div class="report-body">${opts.descriptiveReport || "<em style='color:#9ca3af'>Sin contenido aún...</em>"}</div>
${opts.literal ? `<div class="footer-literal">Literal: <span>${esc(opts.literal)}</span></div>` : ""}
</body></html>`;
}

export default function PreschoolFinalReportModal({
  open, onClose, studentId, studentName, assignmentId, schoolId,
  momento, gradeLevel, reportType, onSaved,
}: PreschoolFinalReportModalProps) {
  const [descriptiveReport, setDescriptiveReport] = useState("");
  const [indicatorValues, setIndicatorValues] = useState<Record<string, string>>({});
  const [literal, setLiteral] = useState("");
  const [absenceCount, setAbsenceCount] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTeacherTab, setActiveTeacherTab] = useState("1");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [observacionesOpen, setObservacionesOpen] = useState(true);
  const [notasOpen, setNotasOpen] = useState(true);

  const preschoolLevel = mapGradeLevelToPreschoolLevel(gradeLevel);

  const levelLabel = (() => {
    switch (gradeLevel) {
      case "pre_maternal": return "Prematernal";
      case "maternal": return "Maternal";
      case "i_nivel": return "1er Nivel";
      case "ii_nivel": return "2do Nivel";
      case "iii_nivel": return "3er Nivel";
      default: return gradeLevel;
    }
  })();

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

  // Load existing report
  const { data: existingReport, isLoading: reportLoading } = useQuery({
    queryKey: ["preschool-final-report", studentId, assignmentId, momento],
    queryFn: async () => {
      const { data } = await supabase
        .from("preschool_final_reports" as any)
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
    queryKey: ["preschool-indicator-grades", studentId, assignmentId, momento],
    queryFn: async () => {
      const { data } = await supabase
        .from("preschool_final_indicator_grades" as any)
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
    queryKey: ["preschool-teacher-plan", assignmentId],
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
    queryKey: ["preschool-teacher-grades", assignmentId, studentId],
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

  // Load preschool components for this level and momento
  const { data: components = [] } = useQuery({
    queryKey: ["preschool-components", schoolId, preschoolLevel, momento],
    queryFn: async () => {
      const { data } = await supabase
        .from("preschool_indicator_components")
        .select("*, indicators:preschool_component_indicators(id, description, display_order)")
        .eq("school_id", schoolId)
        .eq("level", preschoolLevel)
        .eq("momento", String(momento))
        .order("display_order");
      return data || [];
    },
    enabled: open,
  });

  // Load preschool scales
  const { data: scales = [] } = useQuery({
    queryKey: ["preschool-scales", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("preschool_grading_scales")
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
      setAbsenceCount((existingReport as any).absence_count || 0);
      setProjectName((existingReport as any).project_name || "");
    } else {
      setDescriptiveReport("");
      setLiteral("");
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

  // Live preview: regenerate 700ms after any content change
  useEffect(() => {
    if (!open || !schoolData || !assignmentDetail) return;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      try {
        setPreviewHtml(buildPreschoolPreviewHtml({
          schoolName: (schoolData as any)?.name ?? "",
          yearRange: (assignmentDetail as any)?.school_year?.year_range ?? "",
          studentName,
          levelLabel: levelLabel,
          sectionName: (assignmentDetail as any)?.section?.name ?? "",
          literal,
          momento,
          descriptiveReport,
        }));
      } finally {
        setPreviewLoading(false);
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      setPreviewLoading(false);
    };
  }, [open, descriptiveReport, literal, schoolData, assignmentDetail, studentName, momento, levelLabel]);

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
        absence_count: absenceCount,
        project_name: projectName,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("preschool_final_reports" as any)
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
            .from("preschool_final_indicator_grades" as any)
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
            <Badge variant="secondary">{levelLabel}</Badge>
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

            {/* Left column: Componentes (top) + Observaciones del Momento (bottom) */}
            <div className="flex flex-col gap-2 min-h-0">

              {/* Top: Componentes — descriptivo o indicadores */}
              <div className={cn(
                "border rounded-md overflow-hidden flex flex-col min-h-0",
                observacionesOpen ? "flex-[7]" : "flex-1"
              )}>
                <div className="px-3 py-2 bg-muted/30 border-b shrink-0">
                  <h3 className="text-sm font-semibold">
                    {reportType === "descriptive" ? "Componentes — Descriptivo" : "Componentes — Indicadores"}
                  </h3>
                </div>
                <div className="flex-1 p-3 min-h-0">
                  {reportType === "descriptive" ? (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-2">
                        {components.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No hay componentes configurados para este nivel y momento.
                          </p>
                        ) : (
                          <>
                            {components.map((comp: any) => (
                              <div key={comp.id} className="space-y-1.5">
                                <h4 className="text-sm font-semibold text-primary">{comp.name}</h4>
                              </div>
                            ))}
                            <div className="mt-2">
                              <RichTextEditor
                                value={descriptiveReport}
                                onChange={setDescriptiveReport}
                                placeholder="Redacte el informe descriptivo del estudiante..."
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-2">
                        {components.map((comp: any) => (
                          <div key={comp.id}>
                            <h4 className="text-sm font-semibold text-primary mb-2">{comp.name}</h4>
                            <div className="space-y-2">
                              {(comp.indicators || [])
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
                        {components.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No hay componentes configurados para este nivel y momento.
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
                  {previewHtml ? (
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-full border-0"
                      title="Vista previa de boleta"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      Complete los campos para ver la vista previa
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
