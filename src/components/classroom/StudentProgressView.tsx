import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, XCircle, BookOpen, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface StudentInfo {
  id: string;
  document_id: string | null;
  form_data: Record<string, string> | null;
}

interface Props {
  student: StudentInfo;
  assignmentId: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-yellow-600" },
  submitted: { label: "Entregado", color: "text-blue-600" },
  submitted_late: { label: "Entrega tardía", color: "text-orange-600" },
  reviewed: { label: "Revisado", color: "text-purple-600" },
  graded: { label: "Calificado", color: "text-green-600" },
  expired: { label: "Vencido", color: "text-red-600" },
  not_submitted: { label: "No entregado", color: "text-gray-600" },
};

function getStudentName(s: StudentInfo): string {
  const fd = s.form_data || {};
  const parts = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : s.document_id || "Sin nombre";
}

export function StudentProgressView({ student, assignmentId, onBack }: Props) {
  // Fetch all activities for this assignment
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["student-progress-activities", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_activities")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all submissions for this student + assignment
  const { data: submissions = [], isLoading: subsLoading } = useQuery({
    queryKey: ["student-progress-submissions", assignmentId, student.id],
    queryFn: async () => {
      const activityIds = activities.map(a => a.id);
      if (activityIds.length === 0) return [];
      const { data, error } = await supabase
        .from("classroom_submissions")
        .select("*")
        .eq("student_id", student.id)
        .in("activity_id", activityIds);
      if (error) throw error;
      return data || [];
    },
    enabled: activities.length > 0,
  });

  const isLoading = activitiesLoading || subsLoading;
  const subByActivity = new Map(submissions.map((s: any) => [s.activity_id, s]));

  // Compute stats
  const evaluableActivities = activities.filter(a =>
    ["task", "quiz", "evaluated", "forum"].includes(a.activity_type)
  );
  const gradedSubs = submissions.filter((s: any) => s.status === "graded");
  const submittedCount = submissions.filter((s: any) =>
    ["submitted", "submitted_late", "reviewed", "graded"].includes(s.status)
  ).length;
  const totalPoints = gradedSubs.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
  const maxPossible = gradedSubs.reduce((sum: number, s: any) => {
    const act = activities.find(a => a.id === s.activity_id);
    return sum + (act?.max_score || 0);
  }, 0);
  const percentage = maxPossible > 0 ? Math.round((totalPoints / maxPossible) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div>
          <h2 className="font-semibold text-lg">{getStudentName(student)}</h2>
          <p className="text-sm text-muted-foreground">Progreso individual</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{evaluableActivities.length}</p>
          <p className="text-xs text-muted-foreground">Actividades</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{submittedCount}</p>
          <p className="text-xs text-muted-foreground">Entregadas</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{gradedSubs.length}</p>
          <p className="text-xs text-muted-foreground">Calificadas</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{percentage}%</p>
          <p className="text-xs text-muted-foreground">Promedio</p>
        </CardContent></Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso general</span>
            <span className="text-sm text-muted-foreground">
              {submittedCount} de {evaluableActivities.length} actividades entregadas
            </span>
          </div>
          <Progress value={evaluableActivities.length > 0 ? (submittedCount / evaluableActivities.length) * 100 : 0} />
        </CardContent>
      </Card>

      {/* Activities list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Detalle de actividades
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {activities.map((activity: any) => {
              const sub = subByActivity.get(activity.id) as any;
              const status = sub?.status || (activity.due_date && new Date(activity.due_date) < new Date() ? "expired" : "pending");
              const statusCfg = STATUS_LABELS[status] || STATUS_LABELS.pending;

              return (
                <div key={activity.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className={`font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                      {activity.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(activity.due_date), "d MMM", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {sub?.score != null ? (
                      <div>
                        <span className="font-semibold text-sm">
                          {sub.score}{activity.max_score ? `/${activity.max_score}` : ""}
                        </span>
                      </div>
                    ) : activity.max_score ? (
                      <span className="text-xs text-muted-foreground">—/{activity.max_score}</span>
                    ) : null}
                    {sub?.feedback && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 max-w-32 truncate" title={sub.feedback}>
                        💬 {sub.feedback}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {activities.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No hay actividades publicadas.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
