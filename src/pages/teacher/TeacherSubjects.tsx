import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ClipboardList, CheckCircle2, AlertCircle, FileEdit } from "lucide-react";
import { EvaluationPlanModal } from "@/components/teacher/EvaluationPlanModal";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal",
  maternal: "Maternal",
  inicial: "Inicial",
  i_nivel: "I Nivel",
  ii_nivel: "II Nivel",
  iii_nivel: "III Nivel",
  primaria: "Primaria",
  "1_grado": "1er Grado",
  "2_grado": "2do Grado",
  "3_grado": "3er Grado",
  "4_grado": "4to Grado",
  "5_grado": "5to Grado",
  "6_grado": "6to Grado",
  media_general: "Media General",
  "1_ano": "1er Año",
  "2_ano": "2do Año",
  "3_ano": "3er Año",
  "4_ano": "4to Año",
  "5_ano": "5to Año",
  media_tecnica: "Media Técnica",
  "6_ano": "6to Año",
};

interface AssignmentWithDetails {
  id: string;
  school_id: string;
  subject: {
    id: string;
    name: string;
    subject_type: string;
    evaluation_type: string;
  };
  school_year: {
    id: string;
    year_range: string;
    is_active: boolean;
  };
  section: {
    id: string;
    name: string;
    grade_level: string;
  } | null;
}

export default function TeacherSubjects() {
  const { teacher, isLoading: teacherLoading } = useTeacherData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["teacher-subjects", teacher?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id,
          school_id,
          subject:subject_id(id, name, subject_type, evaluation_type),
          school_year:school_year_id(id, year_range, is_active),
          section:section_id(id, name, grade_level)
        `)
        .eq("teacher_id", teacher!.id);

      if (error) throw error;
      return (data as unknown as AssignmentWithDetails[]) || [];
    },
    enabled: !!teacher?.id,
  });

  // Fetch which assignments have evaluation plan items
  const assignmentIds = assignments.map(a => a.id);
  const { data: planCounts = [] } = useQuery({
    queryKey: ["evaluation-plan-counts", assignmentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_plan_items" as any)
        .select("assignment_id")
        .in("assignment_id", assignmentIds);
      if (error) throw error;
      return data as unknown as { assignment_id: string }[];
    },
    enabled: assignmentIds.length > 0,
  });

  const assignmentsWithPlan = new Set(planCounts.map(p => p.assignment_id));

  // Fetch grades config to know if percentage mode is on
  const { data: gradesConfig } = useQuery({
    queryKey: ["grades-config", teacher?.school_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades_config")
        .select("use_percentage_plan")
        .eq("school_id", teacher!.school_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!teacher?.school_id,
  });

  const percentageEnabled = gradesConfig?.use_percentage_plan ?? false;

  const SECONDARY_GRADES = new Set([
    "media_general", "1_ano", "2_ano", "3_ano", "4_ano", "5_ano",
    "media_tecnica", "6_ano",
  ]);

  const isSecondary = (a: AssignmentWithDetails) =>
    a.section ? SECONDARY_GRADES.has(a.section.grade_level) : false;
  const loading = teacherLoading || assignmentsLoading;

  // Group by school year
  const groupedByYear = assignments.reduce<Record<string, AssignmentWithDetails[]>>((acc, a) => {
    const key = a.school_year?.year_range || "Sin año";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const getSectionLabel = (a: AssignmentWithDetails) =>
    a.section
      ? `${GRADE_LABELS[a.section.grade_level] || a.section.grade_level} - Sección ${a.section.name}`
      : "Sin sección";

  return (
    <DashboardLayout>
      <PageHeader title="Mis Materias" breadcrumbs={[{ label: "Inicio", href: "/teacher/dashboard" }, { label: "Mis Materias" }]} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Sin materias asignadas</h3>
          <p className="text-muted-foreground mt-1">Aún no tienes materias asignadas por el colegio.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByYear).map(([yearRange, yearAssignments]) => {
            const isActive = yearAssignments[0]?.school_year?.is_active;
            return (
              <div key={yearRange}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    Año Escolar: {yearRange}
                  </h3>
                  {isActive && (
                    <Badge variant="default" className="text-xs">Activo</Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearAssignments.map((a) => {
                    const sectionLabel = getSectionLabel(a);
                    return (
                      <Card key={a.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{a.subject?.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{sectionLabel}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant={a.subject?.subject_type === "gcrp" ? "secondary" : "outline"} className="text-xs">
                                  {a.subject?.subject_type === "gcrp" ? "GCRP" : "Regular"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {a.subject?.evaluation_type === "literal" ? "Literal" : "Numérica"}
                                </Badge>
                              </div>
                            </div>
                            <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                          {(() => {
                            const hasPlan = assignmentsWithPlan.has(a.id);
                            const planLabel = isSecondary(a) ? "Plan de Evaluación" : "Plan de Clases";
                            return (
                              <div className="flex flex-col gap-2 mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => setSelectedAssignment(a)}
                                >
                                  {hasPlan ? (
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                                  )}
                                  {planLabel}
                                </Button>
                                {hasPlan && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => navigate(`/teacher/materias/${a.id}/notas`)}
                                  >
                                    <FileEdit className="h-4 w-4 mr-2" />
                                    Registrar Notas
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedAssignment && (
        <EvaluationPlanModal
          open={!!selectedAssignment}
          onClose={() => { setSelectedAssignment(null); queryClient.invalidateQueries({ queryKey: ["evaluation-plan-counts", assignmentIds] }); }}
          assignmentId={selectedAssignment.id}
          schoolId={selectedAssignment.school_id}
          subjectName={selectedAssignment.subject?.name || ""}
          sectionLabel={getSectionLabel(selectedAssignment)}
          usePercentage={percentageEnabled && isSecondary(selectedAssignment)}
          planLabel={isSecondary(selectedAssignment) ? "Plan de Evaluación" : "Plan de Clases"}
        />
      )}
    </DashboardLayout>
  );
}
