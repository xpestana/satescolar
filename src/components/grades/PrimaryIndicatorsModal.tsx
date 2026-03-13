import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const GRADES = [
  { value: "1", label: "1er Grado" },
  { value: "2", label: "2do Grado" },
  { value: "3", label: "3er Grado" },
  { value: "4", label: "4to Grado" },
  { value: "5", label: "5to Grado" },
  { value: "6", label: "6to Grado" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
}

interface Indicator {
  id: string;
  grade_level: string;
  area_name: string;
  description: string;
  display_order: number;
}

export function PrimaryIndicatorsModal({ open, onOpenChange, schoolId }: Props) {
  const queryClient = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState("1");
  const [newAreaName, setNewAreaName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editArea, setEditArea] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const queryKey = ["primary-indicators", schoolId];

  const { data: indicators = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("primary_grade_indicators")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data as Indicator[];
    },
    enabled: open && !!schoolId,
  });

  const filtered = indicators.filter((i) => i.grade_level === selectedGrade);

  const addMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = filtered.length > 0 ? Math.max(...filtered.map((i) => i.display_order)) + 1 : 0;
      const { error } = await supabase.from("primary_grade_indicators").insert({
        school_id: schoolId,
        grade_level: selectedGrade,
        area_name: newAreaName.trim(),
        description: newDescription.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewAreaName("");
      setNewDescription("");
      toast.success("Indicador agregado");
    },
    onError: () => toast.error("Error al agregar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, area_name, description }: { id: string; area_name: string; description: string }) => {
      const { error } = await supabase
        .from("primary_grade_indicators")
        .update({ area_name, description, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      toast.success("Indicador actualizado");
    },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("primary_grade_indicators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Indicador eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = filtered.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= filtered.length) return;

      const a = filtered[idx];
      const b = filtered[swapIdx];

      await Promise.all([
        supabase.from("primary_grade_indicators").update({ display_order: b.display_order }).eq("id", a.id),
        supabase.from("primary_grade_indicators").update({ display_order: a.display_order }).eq("id", b.id),
      ]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Indicadores de Primaria</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay indicadores para este grado. Agrega uno abajo.
                </p>
              )}
              {filtered.map((ind, idx) => (
                <div key={ind.id} className="flex items-start gap-2 rounded-lg border p-3">
                  {editingId === ind.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editArea}
                        onChange={(e) => setEditArea(e.target.value)}
                        placeholder="Nombre del área"
                      />
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Descripción"
                        rows={2}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({ id: ind.id, area_name: editArea, description: editDesc })
                          }
                          disabled={!editArea.trim() || updateMutation.isPending}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{ind.area_name}</p>
                        <p className="text-xs text-muted-foreground">{ind.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={idx === 0}
                          onClick={() => reorderMutation.mutate({ id: ind.id, direction: "up" })}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={idx === filtered.length - 1}
                          onClick={() => reorderMutation.mutate({ id: ind.id, direction: "down" })}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingId(ind.id);
                            setEditArea(ind.area_name);
                            setEditDesc(ind.description);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(ind.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new indicator */}
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Agregar indicador</p>
            <Input
              placeholder="Nombre del área"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
            />
            <Textarea
              placeholder="Descripción del indicador"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!newAreaName.trim() || addMutation.isPending}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
