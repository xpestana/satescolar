import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardGridSkeleton } from "@/components/ui/loading-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, CheckCircle2, AlertCircle, FileEdit, History } from "lucide-react";
import { EvaluationPlanModal } from "@/components/teacher/EvaluationPlanModal";
import { GRADE_LABELS, SECONDARY_GRADES } from "@/lib/gradeLevels";

/**
 * "Mis Áreas" of the teacher.
 *
 * The teacher picks ONE school year and sees only its áreas; the years they are not looking at
 * are summarised in a small history (áreas, cuántas con plan, cuántas con notas) so they can tell
 * at a glance what is pending in each one without scrolling through every card of every year.
 */

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

interface YearSummary {
  id: string;
  yearRange: string;
  isActive: boolean;
  total: number;
  withPlan: number;
  withGrades: number;
}

export default function TeacherSubjects() {
  const { teacher, isLoading: teacherLoading } = useTeacherData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
  const [currentMomento, setCurrentMomento] = useState<number>(1);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

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
        .eq("teacher_id", teacher!.id)
        .eq("is_suspended", false);

      if (error) throw error;
      return (data as unknown as AssignmentWithDetails[]) || [];
    },
    enabled: !!teacher?.id,
  });

  const assignmentIds = useMemo(() => assignments.map((a) => a.id), [assignments]);

  // Plan items of every momento: the cards need the selected momento, the history needs "has any".
  const { data: planItems = [] } = useQuery({
    queryKey: ["teacher-plan-items", assignmentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_plan_items" as any)
        .select("assignment_id, momento")
        .in("assignment_id", assignmentIds);
      if (error) throw error;
      return data as unknown as { assignment_id: string; momento: number }[];
    },
    enabled: assignmentIds.length > 0,
  });

  // Which áreas already have grades loaded. Counted with head requests so no row travels.
  const { data: gradedAssignmentIds = new Set<string>() } = useQuery({
    queryKey: ["teacher-graded-assignments", assignmentIds],
    queryFn: async () => {
      const results = await Promise.all(
        assignmentIds.map(async (id) => {
          const { count, error } = await supabase
            .from("student_grades")
            .select("id", { count: "exact", head: true })
            .eq("assignment_id", id);
          if (error) throw error;
          return { id, count: count ?? 0 };
        }),
      );
      return new Set(results.filter((r) => r.count > 0).map((r) => r.id));
    },
    enabled: assignmentIds.length > 0,
  });

  const assignmentsWithPlanForMomento = useMemo(
    () => new Set(planItems.filter((p) => p.momento === currentMomento).map((p) => p.assignment_id)),
    [planItems, currentMomento],
  );
  const assignmentsWithAnyPlan = useMemo(
    () => new Set(planItems.map((p) => p.assignment_id)),
    [planItems],
  );

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

  const isSecondary = (a: AssignmentWithDetails) =>
    a.section ? SECONDARY_GRADES.has(a.section.grade_level) : false;

  const shouldUsePercentage = (a: AssignmentWithDetails) => {
    if (!percentageEnabled) return false;
    if (a.subject?.subject_type === "gcrp") return true;
    return isSecondary(a);
  };

  const getPlanLabel = (a: AssignmentWithDetails) => {
    if (a.subject?.subject_type === "gcrp") return "Plan de Evaluación";
    return isSecondary(a) ? "Plan de Evaluación" : "Plan de Clases";
  };

  const getEvaluationLabel = (a: AssignmentWithDetails) =>
    a.subject?.subject_type === "gcrp"
      ? "Numérica"
      : a.subject?.evaluation_type === "literal"
        ? "Literal"
        : "Numérica";

  const getSectionLabel = (a: AssignmentWithDetails) =>
    a.section
      ? `${GRADE_LABELS[a.section.grade_level] || a.section.grade_level} - Sección ${a.section.name}`
      : a.subject?.subject_type === "gcrp"
        ? "GCRP — Estudiantes individuales"
        : "Sin sección";

  const loading = teacherLoading || assignmentsLoading;

  /** Un resumen por año escolar, el más reciente primero. */
  const yearSummaries = useMemo<YearSummary[]>(() => {
    const byYear = new Map<string, YearSummary>();
    for (const a of assignments) {
      const year = a.school_year;
      if (!year) continue;
      const current =
        byYear.get(year.id) ??
        {
          id: year.id,
          yearRange: year.year_range,
          isActive: year.is_active,
          total: 0,
          withPlan: 0,
          withGrades: 0,
        };
      current.total += 1;
      if (assignmentsWithAnyPlan.has(a.id)) current.withPlan += 1;
      if (gradedAssignmentIds.has(a.id)) current.withGrades += 1;
      byYear.set(year.id, current);
    }
    return [...byYear.values()].sort((a, b) => b.yearRange.localeCompare(a.yearRange));
  }, [assignments, assignmentsWithAnyPlan, gradedAssignmentIds]);

  // Por defecto el año activo; si el docente no tiene áreas allí, el más reciente que sí tenga.
  const defaultYearId = useMemo(() => {
    const active = yearSummaries.find((y) => y.isActive);
    return active?.id || yearSummaries[0]?.id || "";
  }, [yearSummaries]);

  const effectiveYearId =
    selectedYearId && yearSummaries.some((y) => y.id === selectedYearId)
      ? selectedYearId
      : defaultYearId;

  const selectedYear = yearSummaries.find((y) => y.id === effectiveYearId);
  const yearAssignments = useMemo(
    () => assignments.filter((a) => a.school_year?.id === effectiveYearId),
    [assignments, effectiveYearId],
  );
  const otherYears = yearSummaries.filter((y) => y.id !== effectiveYearId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Mis Áreas"
        breadcrumbs={[{ label: "Inicio", href: "/teacher/dashboard" }, { label: "Mis Áreas" }]}
      />

      {loading ? (
        <CardGridSkeleton count={6} columns={3} />
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Sin materias asignadas</h3>
          <p className="text-muted-foreground mt-1">
            Aún no tienes materias asignadas por el colegio.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="w-full sm:w-64">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Año Escolar
              </label>
              <Select value={effectiveYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione año escolar" />
                </SelectTrigger>
                <SelectContent>
                  {yearSummaries.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.yearRange}
                      {y.isActive ? " (Activo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  onClick={() => setCurrentMomento(m)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    currentMomento === m
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Momento {m}
                </button>
              ))}
            </div>
          </div>

          {selectedYear && (
            <p className="text-sm text-muted-foreground">
              {selectedYear.total} área{selectedYear.total === 1 ? "" : "s"} en{" "}
              {selectedYear.yearRange} · {selectedYear.withPlan} con plan ·{" "}
              {selectedYear.withGrades} con notas cargadas
            </p>
          )}

          {yearAssignments.length === 0 ? (
            <div className="text-center py-12 border rounded-md bg-muted/20">
              <p className="text-muted-foreground">
                No tiene áreas asignadas en este año escolar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yearAssignments.map((a) => {
                const sectionLabel = getSectionLabel(a);
                const hasPlan = assignmentsWithPlanForMomento.has(a.id);
                const planLabel = getPlanLabel(a);
                return (
                  <Card key={a.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{a.subject?.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{sectionLabel}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge
                              variant={a.subject?.subject_type === "gcrp" ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {a.subject?.subject_type === "gcrp" ? "GCRP" : "Regular"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getEvaluationLabel(a)}
                            </Badge>
                          </div>
                        </div>
                        <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
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
                            onClick={() =>
                              navigate(`/teacher/materias/${a.id}/notas?momento=${currentMomento}`)
                            }
                          >
                            <FileEdit className="h-4 w-4 mr-2" />
                            Registrar Notas
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {otherYears.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Otros años escolares
                </CardTitle>
                <CardDescription>
                  Resumen de los años que no está viendo. Toque uno para abrir sus áreas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {otherYears.map((y) => (
                  <button
                    key={y.id}
                    onClick={() => setSelectedYearId(y.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium">{y.yearRange}</span>
                      {y.isActive && (
                        <Badge variant="default" className="text-xs">
                          Activo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Badge variant="outline" className="text-xs">
                        {y.total} área{y.total === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {y.withPlan} con plan
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {y.withGrades} con notas
                      </Badge>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedAssignment && (
        <EvaluationPlanModal
          open={!!selectedAssignment}
          onClose={() => {
            setSelectedAssignment(null);
            queryClient.invalidateQueries({ queryKey: ["teacher-plan-items", assignmentIds] });
            queryClient.invalidateQueries({ queryKey: ["teacher-graded-assignments", assignmentIds] });
          }}
          assignmentId={selectedAssignment.id}
          schoolId={selectedAssignment.school_id}
          subjectName={selectedAssignment.subject?.name || ""}
          sectionLabel={getSectionLabel(selectedAssignment)}
          usePercentage={shouldUsePercentage(selectedAssignment)}
          planLabel={getPlanLabel(selectedAssignment)}
          momento={currentMomento}
        />
      )}
    </DashboardLayout>
  );
}
