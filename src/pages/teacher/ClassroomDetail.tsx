import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClassroomConfig, type ClassroomAssignment } from "@/hooks/useClassroomData";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, MessageSquare, BookOpen, Calendar, Users, Loader2 } from "lucide-react";
import { ClassroomConfigModal } from "@/components/classroom/ClassroomConfigModal";
import { TopicsManager } from "@/components/classroom/TopicsManager";
import { StreamFeed } from "@/components/classroom/StreamFeed";
import { ClassworkList } from "@/components/classroom/ClassworkList";
import { PeopleList } from "@/components/classroom/PeopleList";
import { ClassroomCalendar } from "@/components/classroom/ClassroomCalendar";
import { ClassroomNotifications } from "@/components/classroom/ClassroomNotifications";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
  i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
  primaria: "Primaria", "1_grado": "1er Grado", "2_grado": "2do Grado",
  "3_grado": "3er Grado", "4_grado": "4to Grado", "5_grado": "5to Grado",
  "6_grado": "6to Grado", media_general: "Media General",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", media_tecnica: "Media Técnica", "6_ano": "6to Año",
};

export default function ClassroomDetail() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { teacher } = useTeacherData();
  const [configOpen, setConfigOpen] = useState(false);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["classroom-assignment-detail", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id, school_id,
          subject:subject_id(id, name, subject_type, evaluation_type),
          school_year:school_year_id(id, year_range, is_active),
          section:section_id(id, name, grade_level)
        `)
        .eq("id", assignmentId!)
        .single();
      if (error) throw error;
      return data as unknown as ClassroomAssignment;
    },
    enabled: !!assignmentId,
  });

  const { data: config } = useClassroomConfig(assignmentId);

  if (isLoading || !assignment) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const color = config?.color || "#4285f4";
  const sectionLabel = assignment.section
    ? `${GRADE_LABELS[assignment.section.grade_level] || assignment.section.grade_level} - Sección ${assignment.section.name}`
    : "";

  return (
    <DashboardLayout>
      {/* Header banner */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: color }}>
        {config?.cover_url && (
          <img src={config.cover_url} alt="" className="w-full h-32 object-cover" />
        )}
        <div className={`px-6 py-4 ${config?.cover_url ? "" : "py-8"}`}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-sm">
                {assignment.subject?.name}
              </h1>
              <p className="text-white/90 mt-1">{sectionLabel} — {assignment.school_year?.year_range}</p>
              {config?.description && (
                <p className="text-white/80 mt-2 text-sm max-w-2xl">{config.description}</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <Settings className="h-4 w-4 mr-1" /> Configurar
            </Button>
          </div>
        </div>
      </div>

      {/* Welcome message */}
      {config?.welcome_message && (
        <div className="rounded-lg border bg-card p-4 mb-6">
          <p className="text-sm text-muted-foreground">{config.welcome_message}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="stream" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="stream" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Muro
          </TabsTrigger>
          <TabsTrigger value="classwork" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Trabajo
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <Calendar className="h-4 w-4" /> Calendario
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="h-4 w-4" /> Personas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stream">
          <StreamFeed
            assignmentId={assignmentId!}
            schoolId={assignment.school_id}
            allowStudentPosts={config?.allow_student_posts}
          />
        </TabsContent>

        <TabsContent value="classwork">
          <TopicsManager assignmentId={assignmentId!} schoolId={assignment.school_id} />
          <div className="mt-6">
            <ClassworkList assignmentId={assignmentId!} schoolId={assignment.school_id} />
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <ClassroomCalendar assignmentId={assignmentId!} schoolId={assignment.school_id} />
        </TabsContent>

        <TabsContent value="people">
          <PeopleList assignmentId={assignmentId!} schoolId={assignment.school_id} />
        </TabsContent>
      </Tabs>

      {configOpen && (
        <ClassroomConfigModal
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          assignmentId={assignmentId!}
          schoolId={assignment.school_id}
          subjectName={assignment.subject?.name || ""}
        />
      )}
    </DashboardLayout>
  );
}
