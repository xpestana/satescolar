import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Save, GripVertical } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface RubricLevel {
  label: string;
  points: number;
  description: string;
}

interface Criterion {
  id?: string;
  criterion_name: string;
  description: string;
  max_points: number;
  display_order: number;
  levels: RubricLevel[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  activityId: string;
  schoolId: string;
  maxScore: number | null;
}

const DEFAULT_LEVELS: RubricLevel[] = [
  { label: "Excelente", points: 5, description: "" },
  { label: "Bueno", points: 3, description: "" },
  { label: "Regular", points: 1, description: "" },
  { label: "Insuficiente", points: 0, description: "" },
];

export function RubricEditor({ open, onClose, activityId, schoolId, maxScore }: Props) {
  const queryClient = useQueryClient();

  // Fetch existing rubric
  const { data: rubric, isLoading: rubricLoading } = useQuery({
    queryKey: ["classroom-rubric", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_rubrics")
        .select("*")
        .eq("activity_id", activityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingCriteria = [], isLoading: criteriaLoading } = useQuery({
    queryKey: ["classroom-rubric-criteria", rubric?.id],
    queryFn: async () => {
      if (!rubric) return [];
      const { data, error } = await supabase
        .from("classroom_rubric_criteria")
        .select("*")
        .eq("rubric_id", rubric.id)
        .order("display_order");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        criterion_name: c.criterion_name,
        description: c.description || "",
        max_points: c.max_points,
        display_order: c.display_order,
        levels: (c.levels as RubricLevel[]) || DEFAULT_LEVELS,
      }));
    },
    enabled: !!rubric?.id,
  });

  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [title, setTitle] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize from existing data
  if (!initialized && !rubricLoading && !criteriaLoading) {
    setCriteria(existingCriteria.length > 0 ? existingCriteria : [
      {
        criterion_name: "",
        description: "",
        max_points: 5,
        display_order: 0,
        levels: [...DEFAULT_LEVELS],
      },
    ]);
    setTitle(rubric?.title || "Rúbrica");
    setInitialized(true);
  }

  const addCriterion = () => {
    setCriteria(prev => [...prev, {
      criterion_name: "",
      description: "",
      max_points: 5,
      display_order: prev.length,
      levels: [...DEFAULT_LEVELS],
    }]);
  };

  const removeCriterion = (index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, updates: Partial<Criterion>) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const updateLevel = (criterionIndex: number, levelIndex: number, updates: Partial<RubricLevel>) => {
    setCriteria(prev => prev.map((c, ci) => {
      if (ci !== criterionIndex) return c;
      const newLevels = c.levels.map((l, li) => li === levelIndex ? { ...l, ...updates } : l);
      return { ...c, levels: newLevels };
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totalMax = criteria.reduce((sum, c) => sum + c.max_points, 0);

      let rubricId = rubric?.id;

      if (rubricId) {
        // Update
        await supabase.from("classroom_rubrics").update({ title, max_score: totalMax }).eq("id", rubricId);
        // Delete old criteria and recreate
        await supabase.from("classroom_rubric_criteria").delete().eq("rubric_id", rubricId);
      } else {
        // Create
        const { data, error } = await supabase
          .from("classroom_rubrics")
          .insert({ activity_id: activityId, school_id: schoolId, title, max_score: totalMax })
          .select("id")
          .single();
        if (error) throw error;
        rubricId = data.id;
      }

      // Insert criteria
      const rows = criteria.map((c, i) => ({
        rubric_id: rubricId!,
        school_id: schoolId,
        criterion_name: c.criterion_name,
        description: c.description || null,
        max_points: c.max_points,
        display_order: i,
        levels: c.levels as unknown as Json,
      }));

      const { error } = await supabase.from("classroom_rubric_criteria").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-rubric", activityId] });
      queryClient.invalidateQueries({ queryKey: ["classroom-rubric-criteria"] });
      toast({ title: "Rúbrica guardada" });
      onClose();
    },
    onError: () => toast({ title: "Error al guardar rúbrica", variant: "destructive" }),
  });

  if (rubricLoading || criteriaLoading) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <FormSkeleton fields={4} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editor de Rúbrica</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título de la rúbrica</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rúbrica de evaluación" />
          </div>

          {/* Criteria */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Criterios</h3>
              <Button size="sm" variant="outline" onClick={addCriterion}>
                <Plus className="h-4 w-4 mr-1" /> Agregar criterio
              </Button>
            </div>

            {criteria.map((criterion, ci) => (
              <Card key={ci}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-2 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Nombre del criterio</Label>
                          <Input
                            value={criterion.criterion_name}
                            onChange={(e) => updateCriterion(ci, { criterion_name: e.target.value })}
                            placeholder="Ej: Presentación, Contenido..."
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Puntos máximos</Label>
                          <Input
                            type="number"
                            value={criterion.max_points}
                            onChange={(e) => updateCriterion(ci, { max_points: parseInt(e.target.value) || 0 })}
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Descripción (opcional)</Label>
                        <Input
                          value={criterion.description}
                          onChange={(e) => updateCriterion(ci, { description: e.target.value })}
                          placeholder="Descripción del criterio..."
                        />
                      </div>

                      {/* Levels */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Niveles de desempeño</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {criterion.levels.map((level, li) => (
                            <div key={li} className="border rounded-md p-2 space-y-1">
                              <div className="flex gap-2">
                                <Input
                                  value={level.label}
                                  onChange={(e) => updateLevel(ci, li, { label: e.target.value })}
                                  placeholder="Nivel"
                                  className="text-xs h-7"
                                />
                                <Input
                                  type="number"
                                  value={level.points}
                                  onChange={(e) => updateLevel(ci, li, { points: parseInt(e.target.value) || 0 })}
                                  className="text-xs h-7 w-16"
                                  min="0"
                                />
                              </div>
                              <Input
                                value={level.description}
                                onChange={(e) => updateLevel(ci, li, { description: e.target.value })}
                                placeholder="Descripción del nivel..."
                                className="text-xs h-7"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeCriterion(ci)}
                      disabled={criteria.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-muted rounded-md p-3 text-sm">
            <span className="font-medium">Puntaje total de la rúbrica: </span>
            <span className="text-primary font-bold">
              {criteria.reduce((sum, c) => sum + c.max_points, 0)} puntos
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || criteria.some(c => !c.criterion_name.trim())}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Guardar rúbrica
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
