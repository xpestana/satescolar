import { useState } from "react";
import { useClassroomTopics, useCreateTopic, useUpdateTopic, useDeleteTopic, type ClassroomTopic } from "@/hooks/useClassroomData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Plus, GripVertical, Eye, EyeOff, Pencil, Trash2, Check, X, Archive, Loader2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  assignmentId: string;
  schoolId: string;
}

export function TopicsManager({ assignmentId, schoolId }: Props) {
  const { data: topics = [], isLoading } = useClassroomTopics(assignmentId);
  const createTopic = useCreateTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ClassroomTopic | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createTopic.mutateAsync({
        assignment_id: assignmentId,
        school_id: schoolId,
        name: newName.trim(),
        display_order: topics.length,
      });
      setNewName("");
      setAdding(false);
      toast({ title: "Tema creado" });
    } catch {
      toast({ title: "Error al crear tema", variant: "destructive" });
    }
  };

  const handleUpdate = async (topic: ClassroomTopic) => {
    if (!editName.trim()) return;
    try {
      await updateTopic.mutateAsync({
        id: topic.id,
        assignment_id: assignmentId,
        name: editName.trim(),
      });
      setEditingId(null);
      toast({ title: "Tema actualizado" });
    } catch {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  };

  const handleToggleVisibility = async (topic: ClassroomTopic) => {
    await updateTopic.mutateAsync({
      id: topic.id,
      assignment_id: assignmentId,
      is_visible: !topic.is_visible,
    });
  };

  const handleArchive = async (topic: ClassroomTopic) => {
    await updateTopic.mutateAsync({
      id: topic.id,
      assignment_id: assignmentId,
      is_archived: !topic.is_archived,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTopic.mutateAsync({ id: deleteTarget.id, assignment_id: assignmentId });
      setDeleteTarget(null);
      toast({ title: "Tema eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const visibleTopics = topics.filter((t) => !t.is_archived);
  const archivedTopics = topics.filter((t) => t.is_archived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Temas y Unidades</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo tema
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <CardContent className="p-3 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del tema..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Button size="sm" onClick={handleCreate} disabled={createTopic.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {visibleTopics.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aún no hay temas. Crea tu primer tema para organizar el contenido.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleTopics.map((topic) => (
            <Card key={topic.id} className={!topic.is_visible ? "opacity-60" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                {editingId === topic.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(topic)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleUpdate(topic)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-sm">{topic.name}</span>
                    {!topic.is_visible && <Badge variant="secondary" className="text-xs">Oculto</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => handleToggleVisibility(topic)} title={topic.is_visible ? "Ocultar" : "Mostrar"}>
                      {topic.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(topic.id); setEditName(topic.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleArchive(topic)} title="Archivar">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(topic)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {archivedTopics.length > 0 && (
        <div className="pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Archivados</h4>
          <div className="space-y-2">
            {archivedTopics.map((topic) => (
              <Card key={topic.id} className="opacity-50">
                <CardContent className="p-3 flex items-center gap-3">
                  <Archive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm">{topic.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleArchive(topic)} title="Restaurar">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(topic)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tema?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará &quot;{deleteTarget?.name}&quot; y todo su contenido asociado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
