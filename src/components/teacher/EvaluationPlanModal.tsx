import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Save, X } from "lucide-react";

interface EvaluationPlanModalProps {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  schoolId: string;
  subjectName: string;
  sectionLabel: string;
  usePercentage: boolean;
}

interface PlanItem {
  id: string;
  description: string;
  percentage: number | null;
  display_order: number;
}

export function EvaluationPlanModal({
  open,
  onClose,
  assignmentId,
  schoolId,
  subjectName,
  sectionLabel,
  usePercentage,
}: EvaluationPlanModalProps) {
  const queryClient = useQueryClient();
  const [newDescription, setNewDescription] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editPercentage, setEditPercentage] = useState("");

  const queryKey = ["evaluation-plan", assignmentId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_plan_items" as any)
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as PlanItem[]) || [];
    },
    enabled: open && !!assignmentId,
  });

  const totalPercentage = items.reduce((sum, i) => sum + (i.percentage || 0), 0);

  const addMutation = useMutation({
    mutationFn: async () => {
      const desc = newDescription.trim();
      if (!desc) throw new Error("Ingresa una descripción");
      const pct = usePercentage ? Number(newPercentage) : null;
      if (usePercentage) {
        if (!pct || pct <= 0) throw new Error("El porcentaje debe ser mayor a 0");
        if (totalPercentage + pct > 100) throw new Error(`Solo quedan ${100 - totalPercentage}% disponibles`);
      }
      const { error } = await supabase
        .from("evaluation_plan_items" as any)
        .insert({
          assignment_id: assignmentId,
          school_id: schoolId,
          description: desc,
          percentage: pct,
          display_order: items.length,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewDescription("");
      setNewPercentage("");
      toast.success("Evaluación agregada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const desc = editDescription.trim();
      if (!desc) throw new Error("Ingresa una descripción");
      const pct = usePercentage ? Number(editPercentage) : null;
      if (usePercentage) {
        if (!pct || pct <= 0) throw new Error("El porcentaje debe ser mayor a 0");
        const otherTotal = items.filter(i => i.id !== id).reduce((s, i) => s + (i.percentage || 0), 0);
        if (otherTotal + pct > 100) throw new Error(`Solo quedan ${100 - otherTotal}% disponibles`);
      }
      const { error } = await supabase
        .from("evaluation_plan_items" as any)
        .update({ description: desc, percentage: pct, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      toast.success("Evaluación actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("evaluation_plan_items" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Evaluación eliminada");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const startEdit = (item: PlanItem) => {
    setEditingId(item.id);
    setEditDescription(item.description);
    setEditPercentage(item.percentage?.toString() || "");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan de Evaluación</DialogTitle>
          <DialogDescription>
            {subjectName} — {sectionLabel}
          </DialogDescription>
        </DialogHeader>

        {usePercentage && (
          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-muted-foreground">Porcentaje utilizado</span>
            <span className={`font-semibold ${totalPercentage > 100 ? "text-destructive" : totalPercentage === 100 ? "text-green-600" : "text-foreground"}`}>
              {totalPercentage}%
            </span>
          </div>
        )}

        {/* Existing items */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay evaluaciones agregadas aún.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) =>
              editingId === item.id ? (
                <div key={item.id} className="flex items-center gap-2 rounded-md border p-2 bg-muted/30">
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    placeholder="Descripción"
                  />
                  {usePercentage && (
                    <Input
                      type="number"
                      value={editPercentage}
                      onChange={(e) => setEditPercentage(e.target.value)}
                      className="w-20 h-8 text-sm"
                      placeholder="%"
                      min={1}
                      max={100}
                    />
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateMutation.mutate(item.id)} disabled={updateMutation.isPending}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div key={item.id} className="flex items-center justify-between rounded-md border p-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm truncate">{item.description}</span>
                    {usePercentage && item.percentage && (
                      <span className="text-xs font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                        {item.percentage}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Add new item */}
        <div className="border-t pt-3 mt-2">
          <Label className="text-sm font-medium mb-2 block">Agregar evaluación</Label>
          <div className="flex items-center gap-2">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ej: Examen parcial"
              className="flex-1 h-9"
              onKeyDown={(e) => e.key === "Enter" && addMutation.mutate()}
            />
            {usePercentage && (
              <Input
                type="number"
                value={newPercentage}
                onChange={(e) => setNewPercentage(e.target.value)}
                placeholder="%"
                className="w-20 h-9"
                min={1}
                max={100 - totalPercentage}
              />
            )}
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newDescription.trim()}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
