import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClassroomTopics, type ClassroomTopic } from "@/hooks/useClassroomData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, ClipboardList, HelpCircle, BookOpen, Link as LinkIcon,
  Video, File, ChevronDown, ChevronRight, Loader2, Clock, CheckCircle2,
  Users, ClipboardCheck, Ruler,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ActivityFormModal } from "@/components/classroom/ActivityFormModal";
import { SubmissionReview } from "@/components/classroom/SubmissionReview";
import { RubricEditor } from "@/components/classroom/RubricEditor";

interface Props {
  assignmentId: string;
  schoolId: string;
}

interface Activity {
  id: string;
  assignment_id: string;
  school_id: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  activity_type: string;
  status: string;
  due_date: string | null;
  max_score: number | null;
  publish_date: string | null;
  evaluation_plan_item_id: string | null;
  created_at: string;
}

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  task: { label: "Tarea", icon: ClipboardList, color: "text-blue-600" },
  quiz: { label: "Cuestionario", icon: HelpCircle, color: "text-purple-600" },
  forum: { label: "Pregunta / Foro", icon: HelpCircle, color: "text-green-600" },
  material: { label: "Material", icon: BookOpen, color: "text-orange-600" },
  link: { label: "Enlace", icon: LinkIcon, color: "text-cyan-600" },
  video: { label: "Video", icon: Video, color: "text-red-600" },
  document: { label: "Documento", icon: File, color: "text-gray-600" },
  evaluated: { label: "Actividad evaluada", icon: CheckCircle2, color: "text-emerald-600" },
  non_evaluated: { label: "Actividad no evaluada", icon: FileText, color: "text-slate-500" },
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  published: { label: "Publicado", variant: "default" },
  draft: { label: "Borrador", variant: "secondary" },
  scheduled: { label: "Programado", variant: "outline" },
};

const EVALUABLE_TYPES = ["task", "quiz", "evaluated", "forum"];

export function ClassworkList({ assignmentId, schoolId }: Props) {
  const { data: topics = [], isLoading: topicsLoading } = useClassroomTopics(assignmentId);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());
  const [activityModal, setActivityModal] = useState<{ open: boolean; topicId?: string; activity?: Activity }>({ open: false });
  const [reviewActivity, setReviewActivity] = useState<Activity | null>(null);
  const [rubricActivity, setRubricActivity] = useState<Activity | null>(null);

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["classroom-activities", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_activities")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Activity[];
    },
  });

  const isLoading = topicsLoading || activitiesLoading;

  if (isLoading) {
    return <ListItemSkeleton count={4} />;
  }

  // Show submission review mode
  if (reviewActivity) {
    return (
      <SubmissionReview
        activity={reviewActivity}
        onBack={() => setReviewActivity(null)}
      />
    );
  }

  const visibleTopics = topics.filter((t) => !t.is_archived);
  const noTopicActivities = activities.filter((a) => !a.topic_id);

  const toggleTopic = (topicId: string) => {
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const isEvaluable = (type: string) => EVALUABLE_TYPES.includes(type);

  const renderActivity = (activity: Activity) => {
    const config = ACTIVITY_TYPE_CONFIG[activity.activity_type] || ACTIVITY_TYPE_CONFIG.task;
    const Icon = config.icon;
    const statusBadge = STATUS_BADGE[activity.status] || STATUS_BADGE.draft;

    return (
      <Card key={activity.id} className="hover:shadow-sm transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 p-2 rounded-full bg-muted ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => setActivityModal({ open: true, activity })}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{activity.title}</span>
                {activity.status !== "published" && (
                  <Badge variant={statusBadge.variant} className="text-[10px] py-0">
                    {statusBadge.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{config.label}</span>
                {activity.due_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Entrega: {format(new Date(activity.due_date), "d MMM, HH:mm", { locale: es })}
                  </span>
                )}
                {activity.max_score != null && (
                  <span>{activity.max_score} pts</span>
                )}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-1 flex-shrink-0">
              {isEvaluable(activity.activity_type) && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); setReviewActivity(activity); }}
                    title="Ver entregas"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); setRubricActivity(activity); }}
                    title="Rúbrica"
                  >
                    <Ruler className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Create button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setActivityModal({ open: true })}>
          <Plus className="h-4 w-4 mr-1" /> Crear actividad
        </Button>
      </div>

      {/* Activities without topic */}
      {noTopicActivities.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Sin tema asignado</h4>
          {noTopicActivities.map(renderActivity)}
        </div>
      )}

      {/* Topics with activities */}
      {visibleTopics.map((topic) => {
        const topicActivities = activities.filter((a) => a.topic_id === topic.id);
        const isCollapsed = collapsedTopics.has(topic.id);

        return (
          <div key={topic.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                className="flex items-center gap-2 text-foreground font-semibold text-sm hover:text-primary transition-colors"
                onClick={() => toggleTopic(topic.id)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {topic.name}
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {topicActivities.length}
                </Badge>
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setActivityModal({ open: true, topicId: topic.id })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
              </Button>
            </div>

            {!isCollapsed && (
              <div className="space-y-2 pl-6">
                {topicActivities.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No hay actividades en este tema.
                  </p>
                ) : (
                  topicActivities.map(renderActivity)
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {activities.length === 0 && visibleTopics.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin contenido aún</p>
          <p className="text-sm mt-1">Crea temas y actividades para organizar el trabajo de clase.</p>
        </div>
      )}

      {/* Activity Form Modal */}
      {activityModal.open && (
        <ActivityFormModal
          open={activityModal.open}
          onClose={() => setActivityModal({ open: false })}
          assignmentId={assignmentId}
          schoolId={schoolId}
          classroomId={assignmentId}
          topics={visibleTopics}
          defaultTopicId={activityModal.topicId}
          activity={activityModal.activity}
        />
      )}

      {/* Rubric Editor Modal */}
      {rubricActivity && (
        <RubricEditor
          open={!!rubricActivity}
          onClose={() => setRubricActivity(null)}
          activityId={rubricActivity.id}
          schoolId={schoolId}
          maxScore={rubricActivity.max_score}
        />
      )}
    </div>
  );
}
