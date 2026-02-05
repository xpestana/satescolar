import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type FormType = "representative" | "student";

interface FormFieldGroup {
  id: string;
  school_id: string;
  form_type: FormType;
  name: string;
  description: string | null;
  display_order: number;
}

interface FormGroupsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  groups: FormFieldGroup[];
  schoolId: string;
  formType: FormType;
  fieldsCount: Record<string, number>;
}

export function FormGroupsManager({
  isOpen,
  onClose,
  groups,
  schoolId,
  formType,
  fieldsCount,
}: FormGroupsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FormFieldGroup | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  const formTypeLabel = formType === "representative" ? "Representantes" : "Estudiantes";

  const resetForm = () => {
    setGroupName("");
    setGroupDescription("");
    setEditingGroup(null);
    setIsEditModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setIsEditModalOpen(true);
  };

  const openEditModal = (group: FormFieldGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setIsEditModalOpen(true);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = groups.length > 0
        ? Math.max(...groups.map(g => g.display_order)) + 1
        : 0;

      const { error } = await supabase
        .from("form_field_groups")
        .insert({
          school_id: schoolId,
          form_type: formType,
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          display_order: maxOrder,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-field-groups"] });
      resetForm();
      toast({ title: "Grupo creado", description: "El grupo se agregó correctamente." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el grupo." });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingGroup) return;

      const { error } = await supabase
        .from("form_field_groups")
        .update({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
        })
        .eq("id", editingGroup.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-field-groups"] });
      resetForm();
      toast({ title: "Grupo actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el grupo." });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, remove group_id from all fields in this group
      await supabase
        .from("form_fields")
        .update({ group_id: null })
        .eq("group_id", id);

      const { error } = await supabase
        .from("form_field_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-field-groups"] });
      queryClient.invalidateQueries({ queryKey: ["form-fields"] });
      setDeleteId(null);
      toast({ title: "Grupo eliminado", description: "El grupo se eliminó correctamente." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el grupo." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "El nombre del grupo es obligatorio." });
      return;
    }

    if (editingGroup) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="bg-primary -m-6 mb-4 p-6 rounded-t-lg">
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Gestionar Grupos - {formTypeLabel}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Crea y administra los grupos para organizar los campos del formulario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openCreateModal} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Grupo
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Campos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay grupos creados. Haz clic en "Nuevo Grupo" para comenzar.
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group, index) => (
                    <TableRow key={group.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {group.description || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {fieldsCount[group.id] || 0} campos
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(group)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(group.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Group Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Editar Grupo" : "Nuevo Grupo"}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? "Modifica los datos del grupo."
                : "Crea un nuevo grupo para organizar los campos del formulario."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="group_name">Nombre del grupo *</Label>
                <Input
                  id="group_name"
                  placeholder="Ej: Datos Personales"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group_description">Descripción (opcional)</Label>
                <Textarea
                  id="group_description"
                  placeholder="Descripción del grupo..."
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={resetForm} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              El grupo se eliminará pero los campos que pertenecen a él no se borrarán, 
              solo quedarán sin grupo asignado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
