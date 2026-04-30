import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useClassroomConfig, useUpsertClassroomConfig } from "@/hooks/useClassroomData";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  schoolId: string;
  subjectName: string;
}

const COLORS = ["#4285f4", "#0b8043", "#8e24aa", "#e8710a", "#d50000", "#039be5", "#616161", "#f09300"];

export function ClassroomConfigModal({ open, onClose, assignmentId, schoolId, subjectName }: Props) {
  const { data: config, isLoading } = useClassroomConfig(assignmentId);
  const upsert = useUpsertClassroomConfig();

  const [color, setColor] = useState("#4285f4");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [rules, setRules] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowPosts, setAllowPosts] = useState(false);

  useEffect(() => {
    if (config) {
      setColor(config.color);
      setDescription(config.description || "");
      setWelcomeMessage(config.welcome_message || "");
      setRules(config.rules || "");
      setAllowComments(config.allow_student_comments);
      setAllowPosts(config.allow_student_posts);
    }
  }, [config]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        assignment_id: assignmentId,
        school_id: schoolId,
        color,
        description,
        welcome_message: welcomeMessage,
        rules,
        allow_student_comments: allowComments,
        allow_student_posts: allowPosts,
      });
      toast({ title: "Configuración guardada" });
      onClose();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Aula — {subjectName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <FormSkeleton fields={4} />
        ) : (
          <div className="space-y-5">
            <div>
              <Label>Color del aula</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className="h-8 w-8 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
                      transform: color === c ? "scale(1.15)" : "scale(1)",
                    }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción del aula</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el contenido de esta materia..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="welcome">Mensaje de bienvenida</Label>
              <Textarea
                id="welcome"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Mensaje para los estudiantes al entrar al aula..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="rules">Normas del aula</Label>
              <Textarea
                id="rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Normas y reglas de convivencia..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-comments">Permitir comentarios de alumnos</Label>
                <Switch
                  id="allow-comments"
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-posts">Permitir publicaciones de alumnos</Label>
                <Switch
                  id="allow-posts"
                  checked={allowPosts}
                  onCheckedChange={setAllowPosts}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSave} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
