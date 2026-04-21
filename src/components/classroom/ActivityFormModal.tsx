import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClassroomTopic } from "@/hooks/useClassroomData";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Trash2, Download } from "lucide-react";
import { S3AttachmentInput, type PendingAttachment } from "./S3AttachmentInput";
import { supabase as sb } from "@/integrations/supabase/client";

interface Activity {
  id: string;
  assignment_id: string;
  school_id: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  activity_type: string;
  status: string;
  due_date: string | null;
  max_score: number | null;
  publish_date: string | null;
  evaluation_plan_item_id: string | null;
  external_url: string | null;
  allow_late_submission: boolean;
  allow_resubmission: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  schoolId: string;
  classroomId: string;
  topics: ClassroomTopic[];
  defaultTopicId?: string;
  activity?: Partial<Activity>;
}

const ACTIVITY_TYPES = [
  { value: "task", label: "Tarea" },
  { value: "quiz", label: "Cuestionario" },
  { value: "forum", label: "Pregunta / Foro" },
  { value: "material", label: "Material de apoyo" },
  { value: "link", label: "Enlace externo" },
  { value: "video", label: "Video" },
  { value: "document", label: "Documento" },
  { value: "evaluated", label: "Actividad evaluada" },
  { value: "non_evaluated", label: "Actividad no evaluada" },
];

export function ActivityFormModal({ open, onClose, assignmentId, schoolId, classroomId, topics, defaultTopicId, activity }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!activity?.id;

  const [title, setTitle] = useState(activity?.title || "");
  const [description, setDescription] = useState(activity?.description || "");
  const [instructions, setInstructions] = useState(activity?.instructions || "");
  const [activityType, setActivityType] = useState(activity?.activity_type || "task");
  const [topicId, setTopicId] = useState(activity?.topic_id || defaultTopicId || "none");
  const [dueDate, setDueDate] = useState(activity?.due_date?.slice(0, 16) || "");
  const [maxScore, setMaxScore] = useState(activity?.max_score?.toString() || "");
  const [externalUrl, setExternalUrl] = useState(activity?.external_url || "");
  const [status, setStatus] = useState(activity?.status || "published");
  const [allowLate, setAllowLate] = useState(activity?.allow_late_submission ?? false);
  const [allowResub, setAllowResub] = useState(activity?.allow_resubmission ?? false);
  const [evalPlanItemId, setEvalPlanItemId] = useState(activity?.evaluation_plan_item_id || "none");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // Existing attachments (when editing)
  const { data: existingAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["activity-attachments", activity?.id],
    queryFn: async () => {
      if (!activity?.id) return [];
      const { data, error } = await sb
        .from("classroom_activity_attachments")
        .select("*")
        .eq("activity_id", activity.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activity?.id,
  });

  const removeExistingAttachment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("classroom_activity_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchAttachments();
      toast({ title: "Adjunto eliminado" });
    },
  });

  // Fetch evaluation plan items for linking
  const { data: evalPlanItems = [] } = useQuery({
    queryKey: ["evaluation-plan-items-all", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_plan_items")
        .select("id, description, percentage, momento")
        .eq("assignment_id", assignmentId)
        .order("momento")
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        assignment_id: assignmentId,
        school_id: schoolId,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        activity_type: activityType,
        topic_id: topicId === "none" ? null : topicId,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        max_score: maxScore ? parseFloat(maxScore) : null,
        external_url: externalUrl.trim() || null,
        status,
        allow_late_submission: allowLate,
        allow_resubmission: allowResub,
        evaluation_plan_item_id: evalPlanItemId === "none" ? null : evalPlanItemId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("classroom_activities")
          .update(payload)
          .eq("id", activity!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("classroom_activities")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-activities", assignmentId] });
      toast({ title: isEditing ? "Actividad actualizada" : "Actividad creada" });
      onClose();
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("classroom_activities")
        .delete()
        .eq("id", activity!.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-activities", assignmentId] });
      toast({ title: "Actividad eliminada" });
      onClose();
    },
  });

  const needsDueDate = ["task", "quiz", "forum", "evaluated"].includes(activityType);
  const needsScore = ["task", "quiz", "evaluated"].includes(activityType);
  const needsUrl = ["link", "video"].includes(activityType);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tema</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tema</SelectItem>
                  {topics.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la actividad" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción breve..." rows={2} />
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label>Instrucciones</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instrucciones para los estudiantes..." rows={3} />
          </div>

          {/* URL for link/video */}
          {needsUrl && (
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." type="url" />
            </div>
          )}

          {/* Due date + Score */}
          <div className="grid grid-cols-2 gap-4">
            {needsDueDate && (
              <div className="space-y-1.5">
                <Label>Fecha de entrega</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
            {needsScore && (
              <div className="space-y-1.5">
                <Label>Puntaje máximo</Label>
                <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="100" min="0" />
              </div>
            )}
          </div>

          {/* Link to evaluation plan */}
          {needsScore && evalPlanItems.length > 0 && (
            <div className="space-y-1.5">
              <Label>Vincular con Plan de Evaluación</Label>
              <Select value={evalPlanItemId} onValueChange={setEvalPlanItemId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vincular</SelectItem>
                  {evalPlanItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      Momento {item.momento} — {item.description}
                      {item.percentage ? ` (${item.percentage}%)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Vincula esta actividad con una evaluación del plan de notas existente.
              </p>
            </div>
          )}

          {/* Toggles */}
          {needsDueDate && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={allowLate} onCheckedChange={setAllowLate} />
                <Label className="text-sm">Permitir entrega tardía</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowResub} onCheckedChange={setAllowResub} />
                <Label className="text-sm">Permitir reenvío</Label>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Publicar ahora</SelectItem>
                <SelectItem value="draft">Guardar como borrador</SelectItem>
                <SelectItem value="scheduled">Programar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <div>
              {isEditing && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!title.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {isEditing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
