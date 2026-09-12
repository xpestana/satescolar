import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClassroomAssignments, type ClassroomAssignment } from "@/hooks/useClassroomData";
import { useTeacherData } from "@/hooks/useTeacherData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Settings, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardGridSkeleton } from "@/components/ui/loading-skeletons";
import { ClassroomListTutorial } from "@/components/classroom/ClassroomTutorial";
import { GRADE_LABELS } from "@/lib/gradeLevels";

/**
 * Aula Virtual of the teacher: the list of their classrooms.
 *
 * Like "Mis Áreas", it shows ONE school year at a time and summarises the rest in a small history
 * (aulas, cuántas con actividades y cuántas con publicaciones), so an old year is one tap away
 * without stacking every card of every year on screen.
 */

interface YearSummary {
  id: string;
  yearRange: string;
  isActive: boolean;
  total: number;
  withActivities: number;
  withPosts: number;
}

function ClassroomCard({ assignment }: { assignment: ClassroomAssignment }) {
  const navigate = useNavigate();
  const { data: config } = useQuery({
    queryKey: ["classroom-config", assignment.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_config")
        .select("color, description, cover_url")
        .eq("assignment_id", assignment.id)
        .maybeSingle();
      return data;
    },
  });

  const color = config?.color || "#4285f4";
  const sectionLabel = assignment.section
    ? `${GRADE_LABELS[assignment.section.grade_level] || assignment.section.grade_level} - Sección ${assignment.section.name}`
    : assignment.subject?.subject_type === "gcrp" ? "GCRP" : "Sin sección";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all group"
      onClick={() => navigate(`/teacher/aula-virtual/${assignment.id}`)}
    >
      <div className="h-24 relative" style={{ backgroundColor: color }}>
        {config?.cover_url && (
          <img src={config.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white font-semibold text-lg truncate drop-shadow-md">
            {assignment.subject?.name}
          </h3>
          <p className="text-white/90 text-sm truncate drop-shadow-sm">{sectionLabel}</p>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">{assignment.school_year?.year_range}</Badge>
            {assignment.school_year?.is_active && (
              <Badge variant="default" className="text-xs">Activo</Badge>
            )}
          </div>
          <Settings className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {config?.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{config.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClassroomList() {
  const { isLoading: teacherLoading } = useTeacherData();
  const { data: assignments = [], isLoading } = useClassroomAssignments();
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  const loading = teacherLoading || isLoading;
  const assignmentIds = useMemo(() => assignments.map((a) => a.id), [assignments]);

  // Qué aulas tienen contenido. Solo se pide la columna de la asignación, no las filas completas.
  const { data: activity = { withActivities: new Set<string>(), withPosts: new Set<string>() } } =
    useQuery({
      queryKey: ["classroom-content-summary", assignmentIds],
      queryFn: async () => {
        const [activities, posts] = await Promise.all([
          supabase.from("classroom_activities").select("assignment_id").in("assignment_id", assignmentIds),
          supabase.from("classroom_posts").select("assignment_id").in("assignment_id", assignmentIds),
        ]);
        if (activities.error) throw activities.error;
        if (posts.error) throw posts.error;
        return {
          withActivities: new Set((activities.data ?? []).map((r) => r.assignment_id as string)),
          withPosts: new Set((posts.data ?? []).map((r) => r.assignment_id as string)),
        };
      },
      enabled: assignmentIds.length > 0,
    });

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
          withActivities: 0,
          withPosts: 0,
        };
      current.total += 1;
      if (activity.withActivities.has(a.id)) current.withActivities += 1;
      if (activity.withPosts.has(a.id)) current.withPosts += 1;
      byYear.set(year.id, current);
    }
    return [...byYear.values()].sort((a, b) => b.yearRange.localeCompare(a.yearRange));
  }, [assignments, activity]);

  // Por defecto el año activo; si el docente no tiene aulas allí, el más reciente que sí tenga.
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
        title="Aula Virtual"
        breadcrumbs={[{ label: "Inicio", href: "/teacher/dashboard" }, { label: "Aula Virtual" }]}
      />

      <ClassroomListTutorial />

      {loading ? (
        <CardGridSkeleton count={6} columns={3} />
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Sin aulas disponibles</h3>
          <p className="text-muted-foreground mt-1">No tienes materias asignadas para el aula virtual.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="w-full sm:w-64">
            <label className="text-sm font-medium text-foreground mb-1.5 block">Año Escolar</label>
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

          {selectedYear && (
            <p className="text-sm text-muted-foreground">
              {selectedYear.total} aula{selectedYear.total === 1 ? "" : "s"} en{" "}
              {selectedYear.yearRange} · {selectedYear.withActivities} con actividades ·{" "}
              {selectedYear.withPosts} con publicaciones
            </p>
          )}

          {yearAssignments.length === 0 ? (
            <div className="text-center py-12 border rounded-md bg-muted/20">
              <p className="text-muted-foreground">No tiene aulas en este año escolar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yearAssignments.map((a) => (
                <ClassroomCard key={a.id} assignment={a} />
              ))}
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
                  Resumen de los años que no está viendo. Toque uno para abrir sus aulas.
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
                        {y.total} aula{y.total === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {y.withActivities} con actividades
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {y.withPosts} con publicaciones
                      </Badge>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
