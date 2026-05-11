import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Calendar, FileText, Clock, CheckCircle2, AlertCircle, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { AccessCodeGate } from "@/components/classroom/AccessCodeGate";
import { ChildClassroomTutorial } from "@/components/classroom/ClassroomTutorial";
import { StudentSubmissionPanel } from "@/components/classroom/StudentSubmissionPanel";
import { CommentsAndReactions } from "@/components/classroom/CommentsAndReactions";
import { formatGradeLevel } from "@/lib/utils";

export default function ChildClassroom() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { familyId, schoolId } = useRepresentativeFamily();
  const [verified, setVerified] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

  // Get student info
  const { data: student } = useQuery({
    queryKey: ["student-info", studentId],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("id", studentId!).single();
      return data;
    },
    enabled: !!studentId,
  });

  // Get active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-year-rep", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("id, year_range")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!schoolId,
  });

  // Get student's enrollments → sections → assignments (subjects)
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["child-subjects", studentId, activeYear?.id],
    queryFn: async () => {
      // Get enrollments for this student in active year
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("section_id")
        .eq("student_id", studentId!)
        .eq("school_year_id", activeYear!.id);

      if (!enrollments?.length) return [];

      const sectionIds = enrollments.map((e) => e.section_id);

      // Get assignments for those sections
      const { data: assignments } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id, school_id,
          subject:subject_id(id, name, subject_type, evaluation_type),
          section:section_id(id, name, grade_level),
          teacher:teacher_id(id, form_data)
        `)
        .in("section_id", sectionIds)
        .eq("school_year_id", activeYear!.id)
        .eq("is_suspended", false);

      return (assignments as any[]) || [];
    },
    enabled: !!studentId && !!activeYear?.id && verified,
  });

  // Get activities for selected assignment
  const { data: activities = [] } = useQuery({
    queryKey: ["child-activities", selectedAssignment],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_activities")
        .select("*")
        .eq("assignment_id", selectedAssignment!)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedAssignment && verified,
  });

  // Get submissions for selected assignment
  const { data: submissions = [] } = useQuery({
    queryKey: ["child-submissions", selectedAssignment, studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_submissions")
        .select("*")
        .eq("student_id", studentId!)
        .in(
          "activity_id",
          activities.map((a) => a.id)
        );
      return data || [];
    },
    enabled: !!selectedAssignment && !!studentId && activities.length > 0 && verified,
  });

  // Get posts for selected assignment
  const { data: posts = [] } = useQuery({
    queryKey: ["child-posts", selectedAssignment],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_posts")
        .select("*")
        .eq("assignment_id", selectedAssignment!)
        .eq("status", "published")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!selectedAssignment && verified,
  });

  const getStudentName = () => {
    if (!student) return "Estudiante";
    const fd = (student.form_data as Record<string, any>) || {};
    return `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim() || "Estudiante";
  };

  const getTeacherName = (teacher: any) => {
    if (!teacher?.form_data) return "Docente";
    const fd = teacher.form_data as Record<string, any>;
    return `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim();
  };

  const getSubmissionForActivity = (actId: string) => submissions.find((s) => s.activity_id === actId);

  const getStatusBadge = (activity: any) => {
    const sub = getSubmissionForActivity(activity.id);
    if (sub?.status === "graded") {
      return (
        <Badge className="bg-green-100 text-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Calificado: {sub.score}/{activity.max_score || "—"}
        </Badge>
      );
    }
    if (sub?.status === "submitted" || sub?.status === "submitted_late") {
      return <Badge variant="secondary">Entregado</Badge>;
    }
    if (activity.due_date && new Date(activity.due_date) < new Date()) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Vencido
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" />
        Pendiente
      </Badge>
    );
  };

  // Gate: require access code before showing classroom data
  if (!verified) {
    return (
      <DashboardLayout>
        <PageHeader
          title="Aula Virtual"
          breadcrumbs={[
            { label: "Dashboard", href: "/representative/dashboard" },
            { label: "Estudiantes", href: "/representative/estudiantes" },
            { label: "Aula Virtual" },
          ]}
        />
        <AccessCodeGate
          studentId={studentId!}
          schoolId={schoolId!}
          onVerified={() => setVerified(true)}
        />
      </DashboardLayout>
    );
  }

  const selectedSubject = subjects.find((s) => s.id === selectedAssignment);

  return (
    <DashboardLayout>
      <PageHeader
        title={`Aula Virtual — ${getStudentName()}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/representative/dashboard" },
          { label: "Estudiantes", href: "/representative/estudiantes" },
          { label: "Aula Virtual" },
        ]}
      />

      <ChildClassroomTutorial />

      {!selectedAssignment ? (
        // Subject cards grid
        <div>
          <p className="text-muted-foreground mb-4">
            Selecciona una materia para ver el aula virtual de {getStudentName()}.
          </p>
          {loadingSubjects ? (
            <div className="text-center py-8 text-muted-foreground">Cargando materias...</div>
          ) : subjects.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay materias asignadas para este estudiante en el período activo.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subj: any) => (
                <Card
                  key={subj.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: "#4285f4" }}
                  onClick={() => setSelectedAssignment(subj.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{subj.subject?.name || "Materia"}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {subj.section ? `${formatGradeLevel(subj.section.grade_level)} — ${subj.section.name}` : "General"}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Prof. {getTeacherName(subj.teacher)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Selected subject detail
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => setSelectedAssignment(null)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver a materias
          </Button>

          <div className="mb-4">
            <h2 className="text-xl font-semibold">{selectedSubject?.subject?.name}</h2>
            <p className="text-sm text-muted-foreground">
              Prof. {getTeacherName(selectedSubject?.teacher)} — {selectedSubject?.section ? `${formatGradeLevel(selectedSubject.section.grade_level)} ${selectedSubject.section.name}` : ""}
            </p>
          </div>

          <Tabs defaultValue="feed">
            <TabsList>
              <TabsTrigger value="feed">
                <BookOpen className="h-4 w-4 mr-1" />
                Muro
              </TabsTrigger>
              <TabsTrigger value="work">
                <FileText className="h-4 w-4 mr-1" />
                Actividades
              </TabsTrigger>
              <TabsTrigger value="grades">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Calificaciones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="space-y-3 mt-4">
              {posts.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    No hay publicaciones aún.
                  </CardContent>
                </Card>
              ) : (
                posts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-4">
                      {post.is_pinned && <Badge variant="secondary" className="mb-2">📌 Fijado</Badge>}
                      {post.title && <p className="font-semibold mb-1">{post.title}</p>}
                      <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(post.created_at).toLocaleDateString("es-VE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {schoolId && (
                        <CommentsAndReactions
                          schoolId={schoolId}
                          postId={post.id}
                          allowComments={post.allow_comments !== false}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="work" className="space-y-3 mt-4">
              {activities.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    No hay actividades publicadas aún.
                  </CardContent>
                </Card>
              ) : (
                activities.map((act) => (
                  <Card key={act.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold">{act.title}</p>
                          {act.description && (
                            <p className="text-sm text-muted-foreground mt-1">{act.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="capitalize">{act.activity_type}</span>
                            {act.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(act.due_date).toLocaleDateString("es-VE")}
                              </span>
                            )}
                            {act.max_score && <span>Puntos: {act.max_score}</span>}
                          </div>
                        </div>
                        {getStatusBadge(act)}
                      </div>

                      {/* Submission panel for evaluable activities */}
                      {["task", "quiz", "forum", "evaluated"].includes(act.activity_type) && studentId && selectedAssignment && (
                        <StudentSubmissionPanel
                          activity={{
                            id: act.id,
                            title: act.title,
                            due_date: act.due_date,
                            max_score: act.max_score,
                            allow_late_submission: act.allow_late_submission,
                            allow_resubmission: act.allow_resubmission,
                            school_id: act.school_id,
                            assignment_id: act.assignment_id,
                          }}
                          studentId={studentId}
                          classroomId={selectedAssignment}
                        />
                      )}

                      {act.school_id && (
                        <CommentsAndReactions
                          schoolId={act.school_id}
                          activityId={act.id}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="grades" className="mt-4">
              {activities.filter((a) => ["task", "quiz", "forum", "evaluated"].includes(a.activity_type)).length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    No hay actividades evaluables aún.
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Actividad</th>
                        <th className="text-left p-3 font-medium">Tipo</th>
                        <th className="text-center p-3 font-medium">Nota</th>
                        <th className="text-center p-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities
                        .filter((a) => ["task", "quiz", "forum", "evaluated"].includes(a.activity_type))
                        .map((act) => {
                          const sub = getSubmissionForActivity(act.id);
                          return (
                            <tr key={act.id} className="border-t">
                              <td className="p-3">{act.title}</td>
                              <td className="p-3 capitalize">{act.activity_type}</td>
                              <td className="p-3 text-center font-medium">
                                {sub?.score != null ? `${sub.score}/${act.max_score || "—"}` : "—"}
                              </td>
                              <td className="p-3 text-center">{getStatusBadge(act)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </DashboardLayout>
  );
}
