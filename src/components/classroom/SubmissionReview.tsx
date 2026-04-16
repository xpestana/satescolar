import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, XCircle,
  Loader2, Send, FileText, Download, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Activity {
  id: string;
  title: string;
  activity_type: string;
  max_score: number | null;
  due_date: string | null;
  assignment_id: string;
  school_id: string;
}

interface Submission {
  id: string;
  activity_id: string;
  student_id: string;
  status: string;
  content: string | null;
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
}

interface StudentInfo {
  id: string;
  document_id: string | null;
  form_data: Record<string, string> | null;
}

interface Props {
  activity: Activity;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  submitted: { label: "Entregado", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  submitted_late: { label: "Entrega tardía", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
  reviewed: { label: "Revisado", color: "bg-purple-100 text-purple-800", icon: Eye },
  graded: { label: "Calificado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  expired: { label: "Vencido", color: "bg-red-100 text-red-800", icon: XCircle },
  not_submitted: { label: "No entregado", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

function getStudentName(s: StudentInfo): string {
  const fd = s.form_data || {};
  const parts = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : s.document_id || "Sin nombre";
}

export function SubmissionReview({ activity, onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradingSubmission, setGradingSubmission] = useState<(Submission & { student: StudentInfo }) | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");

  // Fetch enrolled students for this assignment's section
  const { data: students = [] } = useQuery({
    queryKey: ["assignment-students", activity.assignment_id],
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from("subject_teacher_assignments")
        .select("section_id, school_year_id")
        .eq("id", activity.assignment_id)
        .single();
      if (!assignment) return [];

      const { data, error } = await supabase
        .from("enrollments")
        .select("student:student_id(id, document_id, form_data)")
        .eq("section_id", assignment.section_id)
        .eq("school_year_id", assignment.school_year_id);
      if (error) throw error;
      return ((data || []) as any[]).map((e: any) => e.student as StudentInfo).filter(Boolean);
    },
  });

  // Fetch submissions
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["activity-submissions", activity.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_submissions")
        .select("*")
        .eq("activity_id", activity.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Submission[];
    },
  });

  // Fetch submission attachments
  const { data: attachmentsMap = {} } = useQuery({
    queryKey: ["submission-attachments", activity.id],
    queryFn: async () => {
      const subIds = submissions.map(s => s.id);
      if (subIds.length === 0) return {};
      const { data, error } = await supabase
        .from("classroom_submission_attachments")
        .select("*")
        .in("submission_id", subIds);
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (data || []).forEach((a: any) => {
        if (!map[a.submission_id]) map[a.submission_id] = [];
        map[a.submission_id].push(a);
      });
      return map;
    },
    enabled: submissions.length > 0,
  });

  // Build merged list: all students with their submission status
  const submissionByStudent = new Map(submissions.map(s => [s.student_id, s]));
  const mergedList = students.map(student => {
    const sub = submissionByStudent.get(student.id);
    return {
      student,
      submission: sub || null,
      status: sub?.status || (activity.due_date && new Date(activity.due_date) < new Date() ? "expired" : "pending"),
    };
  });

  const filtered = statusFilter === "all"
    ? mergedList
    : mergedList.filter(m => m.status === statusFilter);

  // Grade mutation
  const gradeMutation = useMutation({
    mutationFn: async () => {
      if (!gradingSubmission) return;
      const score = gradeScore ? parseFloat(gradeScore) : null;

      if (gradingSubmission.submission) {
        const { error } = await supabase
          .from("classroom_submissions")
          .update({
            score,
            feedback: gradeFeedback.trim() || null,
            status: "graded",
            graded_at: new Date().toISOString(),
            graded_by: user!.id,
          })
          .eq("id", gradingSubmission.submission.id);
        if (error) throw error;
      } else {
        // Create a submission record for students who didn't submit
        const { error } = await supabase
          .from("classroom_submissions")
          .insert({
            activity_id: activity.id,
            student_id: gradingSubmission.student.id,
            school_id: activity.school_id,
            score,
            feedback: gradeFeedback.trim() || null,
            status: "graded",
            graded_at: new Date().toISOString(),
            graded_by: user!.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-submissions", activity.id] });
      setGradingSubmission(null);
      setGradeScore("");
      setGradeFeedback("");
      toast({ title: "Calificación guardada" });
    },
    onError: () => toast({ title: "Error al calificar", variant: "destructive" }),
  });

  // Mark as reviewed
  const markReviewed = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase
        .from("classroom_submissions")
        .update({ status: "reviewed" })
        .eq("id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-submissions", activity.id] });
      toast({ title: "Marcado como revisado" });
    },
  });

  const stats = {
    total: mergedList.length,
    submitted: mergedList.filter(m => ["submitted", "submitted_late"].includes(m.status)).length,
    graded: mergedList.filter(m => m.status === "graded").length,
    pending: mergedList.filter(m => ["pending", "expired"].includes(m.status)).length,
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold text-lg">{activity.title}</h2>
          <p className="text-sm text-muted-foreground">
            Revisión de entregas
            {activity.max_score != null && ` • Puntaje máximo: ${activity.max_score}`}
            {activity.due_date && ` • Entrega: ${format(new Date(activity.due_date), "d MMM yyyy, HH:mm", { locale: es })}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
          <p className="text-xs text-muted-foreground">Entregados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.graded}</p>
          <p className="text-xs text-muted-foreground">Calificados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm">Filtrar:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="submitted">Entregados</SelectItem>
            <SelectItem value="submitted_late">Entrega tardía</SelectItem>
            <SelectItem value="graded">Calificados</SelectItem>
            <SelectItem value="reviewed">Revisados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="expired">Vencidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Entregado</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(({ student, submission, status }) => {
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                const subAttachments = submission ? (attachmentsMap[submission.id] || []) : [];

                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium text-sm">
                      {getStudentName(student)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {submission?.submitted_at
                        ? format(new Date(submission.submitted_at), "d MMM, HH:mm", { locale: es })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {submission?.score != null ? (
                        <span className="font-semibold text-sm">
                          {submission.score}{activity.max_score ? `/${activity.max_score}` : ""}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {submission && ["submitted", "submitted_late"].includes(submission.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => markReviewed.mutate(submission.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            setGradingSubmission({ ...(submission || {} as any), student });
                            setGradeScore(submission?.score?.toString() || "");
                            setGradeFeedback(submission?.feedback || "");
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Calificar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron estudiantes con este filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Grading dialog */}
      <Dialog open={!!gradingSubmission} onOpenChange={(v) => !v && setGradingSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Calificar — {gradingSubmission?.student ? getStudentName(gradingSubmission.student) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Submission content preview */}
            {gradingSubmission?.submission?.content && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Respuesta del estudiante</Label>
                <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {gradingSubmission.submission.content}
                </div>
              </div>
            )}

            {!gradingSubmission?.submission && (
              <p className="text-sm text-muted-foreground italic">
                Este estudiante no ha realizado una entrega.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nota</Label>
                <Input
                  type="number"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  placeholder={activity.max_score ? `Máx: ${activity.max_score}` : "Nota"}
                  min="0"
                  max={activity.max_score || undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado resultante</Label>
                <div className="flex items-center h-9 px-3 text-sm rounded-md border bg-muted text-muted-foreground">
                  Calificado
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Retroalimentación</Label>
              <Textarea
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                placeholder="Comentarios para el estudiante..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGradingSubmission(null)}>Cancelar</Button>
              <Button
                onClick={() => gradeMutation.mutate()}
                disabled={gradeMutation.isPending}
              >
                {gradeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Guardar calificación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
