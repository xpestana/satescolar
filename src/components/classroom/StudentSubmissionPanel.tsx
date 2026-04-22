import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Download, CheckCircle2 } from "lucide-react";
import { S3AttachmentInput, type PendingAttachment } from "./S3AttachmentInput";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Activity {
  id: string;
  title: string;
  due_date: string | null;
  max_score: number | null;
  allow_late_submission: boolean;
  allow_resubmission: boolean;
  school_id: string;
  assignment_id: string;
}

interface Props {
  activity: Activity;
  studentId: string;
  classroomId: string;
}

/**
 * Panel donde el estudiante (rol representante) envía su entrega
 * con texto opcional y adjuntos a S3.
 */
export function StudentSubmissionPanel({ activity, studentId, classroomId }: Props) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  // Existing submission
  const { data: submission } = useQuery({
    queryKey: ["student-submission", activity.id, studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_submissions")
        .select("*")
        .eq("activity_id", activity.id)
        .eq("student_id", studentId)
        .maybeSingle();
      return data;
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["student-submission-attachments", submission?.id],
    queryFn: async () => {
      if (!submission?.id) return [];
      const { data } = await supabase
        .from("classroom_submission_attachments")
        .select("*")
        .eq("submission_id", submission.id);
      return data || [];
    },
    enabled: !!submission?.id,
  });

  useEffect(() => {
    if (submission?.content) setContent(submission.content);
  }, [submission?.id]);

  const isPastDue = activity.due_date && new Date(activity.due_date) < new Date();
  const alreadySubmitted = submission && ["submitted", "submitted_late", "graded", "reviewed"].includes(submission.status);
  const canSubmit = !alreadySubmitted || activity.allow_resubmission;
  const canSubmitNow = canSubmit && (!isPastDue || activity.allow_late_submission);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const uploaded = pending.filter(a => a.publicUrl);
      const status = isPastDue ? "submitted_late" : "submitted";

      let submissionId = submission?.id;
      if (submission) {
        const { error } = await supabase
          .from("classroom_submissions")
          .update({
            content: content.trim() || null,
            status,
            submitted_at: new Date().toISOString(),
          })
          .eq("id", submission.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("classroom_submissions")
          .insert({
            activity_id: activity.id,
            student_id: studentId,
            school_id: activity.school_id,
            content: content.trim() || null,
            status,
            submitted_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        submissionId = data.id;
      }

      if (uploaded.length > 0 && submissionId) {
        const rows = uploaded.map(a => ({
          submission_id: submissionId!,
          school_id: activity.school_id,
          file_url: a.publicUrl!,
          file_name: a.file.name,
          file_size: a.file.size,
          file_type: a.file.type || null,
        }));
        const { error: attErr } = await supabase
          .from("classroom_submission_attachments")
          .insert(rows);
        if (attErr) throw attErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-submission", activity.id, studentId] });
      queryClient.invalidateQueries({ queryKey: ["child-submissions"] });
      setPending([]);
      toast({ title: "Entrega enviada" });
    },
    onError: (e: any) => toast({
      title: "Error al enviar",
      description: e?.message || "Inténtalo nuevamente",
      variant: "destructive",
    }),
  });

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Tu entrega</Label>
          {submission && (
            <Badge variant={submission.status === "graded" ? "default" : "secondary"} className="text-xs">
              {submission.status === "graded" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {submission.status === "graded" ? `Calificado: ${submission.score ?? "—"}/${activity.max_score ?? "—"}` : "Enviado"}
            </Badge>
          )}
        </div>

        {submission?.submitted_at && (
          <p className="text-xs text-muted-foreground">
            Enviado el {format(new Date(submission.submitted_at), "d MMM yyyy, HH:mm", { locale: es })}
          </p>
        )}

        {submission?.feedback && (
          <div className="bg-muted/40 rounded p-2 text-sm">
            <p className="text-xs font-semibold mb-1">Comentarios del docente:</p>
            <p className="whitespace-pre-wrap">{submission.feedback}</p>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Archivos enviados</Label>
            <div className="flex flex-col gap-1">
              {attachments.map((a: any) => (
                <a
                  key={a.id}
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1.5 p-1.5 bg-muted/40 rounded"
                >
                  <Download className="h-3 w-3 shrink-0" />
                  <span className="truncate">{a.file_name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {canSubmitNow ? (
          <>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu respuesta o comentario (opcional)..."
              rows={3}
            />
            <S3AttachmentInput
              folder="submissions"
              schoolId={activity.school_id}
              classroomId={classroomId}
              entityId={studentId}
              attachments={pending}
              onChange={setPending}
              buttonLabel="Adjuntar archivo"
            />
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || (!content.trim() && pending.filter(a => a.publicUrl).length === 0) || pending.some(a => a.uploading)}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              {alreadySubmitted ? "Reenviar entrega" : "Enviar entrega"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {alreadySubmitted
              ? "Ya enviaste esta actividad. El docente no permite reenvíos."
              : "El plazo de entrega ya venció y no se permiten entregas tardías."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
