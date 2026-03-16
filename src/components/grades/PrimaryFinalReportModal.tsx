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
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/utilities/RichTextEditor";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [saving, setSaving] = useState(false);
  const [activeTeacherTab, setActiveTeacherTab] = useState("1");

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

  // Load teacher grades (evaluation plan items + student grades) for all 3 momentos
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

  // Load indicators and scales for indicators mode
  const { data: areas = [] } = useQuery({
    queryKey: ["primary-areas", schoolId, gradeLevel],
    queryFn: async () => {
      const { data } = await supabase
        .from("primary_indicator_areas")
        .select("*, indicators:primary_grade_indicators(id, description, display_order)")
        .eq("school_id", schoolId)
        .eq("grade_level", gradeLevel)
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
    } else {
      setDescriptiveReport("");
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save descriptive report
      const reportPayload = {
        student_id: studentId,
        assignment_id: assignmentId,
        school_id: schoolId,
        momento,
        descriptive_report: descriptiveReport,
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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Informe — {studentName}
            <Badge variant="outline">Momento {momento === 0 ? "Final" : momento}</Badge>
            <Badge variant="secondary">{reportType === "descriptive" ? "Descriptivo" : "Por Indicadores"}</Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
            {/* Left panel: Teacher grades */}
            <div className="border rounded-md overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-muted/30 border-b">
                <h3 className="text-sm font-semibold">Notas del Docente</h3>
              </div>
              <Tabs value={activeTeacherTab} onValueChange={setActiveTeacherTab} className="flex-1 flex flex-col">
                <TabsList className="mx-2 mt-2">
                  {[1, 2, 3].map((m) => (
                    <TabsTrigger key={m} value={String(m)} className="text-xs">
                      Momento {m}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {[1, 2, 3].map((m) => (
                  <TabsContent key={m} value={String(m)} className="flex-1 px-3 pb-3">
                    <ScrollArea className="h-[350px]">
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
            </div>

            {/* Right panel: Editor */}
            <div className="border rounded-md overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-muted/30 border-b">
                <h3 className="text-sm font-semibold">
                  {reportType === "descriptive" ? "Informe Descriptivo" : "Indicadores"}
                </h3>
              </div>
              <ScrollArea className="flex-1 p-3">
                {reportType === "descriptive" ? (
                  <RichTextEditor
                    value={descriptiveReport}
                    onChange={setDescriptiveReport}
                    placeholder="Redacte el informe descriptivo del estudiante..."
                    minHeight={300}
                  />
                ) : (
                  <div className="space-y-4">
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
                    {/* Also allow descriptive text in indicators mode */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-2">Observación Descriptiva</h4>
                      <RichTextEditor
                        value={descriptiveReport}
                        onChange={setDescriptiveReport}
                        placeholder="Observación adicional del estudiante..."
                        minHeight={150}
                      />
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
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
