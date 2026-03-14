import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface Area {
  id: string;
  grade_level: string;
  name: string;
  display_order: number;
}

interface Indicator {
  id: string;
  area_id: string | null;
  grade_level: string;
  area_name: string;
  description: string;
  display_order: number;
}

export function PrimaryIndicatorsModal({ open, onOpenChange, schoolId }: Props) {
  const queryClient = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState("1");
  const [newAreaName, setNewAreaName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editAreaName, setEditAreaName] = useState("");
  const [newIndicatorText, setNewIndicatorText] = useState<Record<string, string>>({});
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [editIndicatorDesc, setEditIndicatorDesc] = useState("");
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());

  const areasKey = ["primary-indicator-areas", schoolId];
  const indicatorsKey = ["primary-indicators", schoolId];

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: areasKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("primary_indicator_areas")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data as Area[];
    },
    enabled: open && !!schoolId,
  });

  const { data: indicators = [], isLoading: indicatorsLoading } = useQuery({
    queryKey: indicatorsKey,
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

  const filteredAreas = areas.filter((a) => a.grade_level === selectedGrade);
  const getIndicatorsForArea = (areaId: string) =>
    indicators.filter((i) => i.area_id === areaId);

  const toggleArea = (areaId: string) => {
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  // --- Area mutations ---
  const addArea = useMutation({
    mutationFn: async () => {
      const maxOrder = filteredAreas.length > 0 ? Math.max(...filteredAreas.map((a) => a.display_order)) + 1 : 0;
      const { error } = await supabase.from("primary_indicator_areas").insert({
        school_id: schoolId,
        grade_level: selectedGrade,
        name: newAreaName.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areasKey });
      setNewAreaName("");
      toast.success("Área agregada");
    },
    onError: () => toast.error("Error al agregar área"),
  });

  const updateArea = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("primary_indicator_areas")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areasKey });
      setEditingAreaId(null);
      toast.success("Área actualizada");
    },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("primary_indicator_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areasKey });
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      toast.success("Área eliminada");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  // --- Indicator mutations ---
  const addIndicator = useMutation({
    mutationFn: async ({ areaId, description }: { areaId: string; description: string }) => {
      const areaIndicators = getIndicatorsForArea(areaId);
      const maxOrder = areaIndicators.length > 0 ? Math.max(...areaIndicators.map((i) => i.display_order)) + 1 : 0;
      const area = areas.find((a) => a.id === areaId);
      const { error } = await supabase.from("primary_grade_indicators").insert({
        school_id: schoolId,
        grade_level: selectedGrade,
        area_id: areaId,
        area_name: area?.name ?? "",
        description: description.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: (_, { areaId }) => {
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      setNewIndicatorText((prev) => ({ ...prev, [areaId]: "" }));
      toast.success("Indicador agregado");
    },
    onError: () => toast.error("Error al agregar indicador"),
  });

  const updateIndicator = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const { error } = await supabase
        .from("primary_grade_indicators")
        .update({ description, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      setEditingIndicatorId(null);
      toast.success("Indicador actualizado");
    },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteIndicator = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("primary_grade_indicators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      toast.success("Indicador eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const isLoading = areasLoading || indicatorsLoading;

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
              {filteredAreas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay áreas para este grado. Agrega una abajo.
                </p>
              )}

              {filteredAreas.map((area) => {
                const areaIndicators = getIndicatorsForArea(area.id);
                const isOpen = openAreas.has(area.id);

                return (
                  <Collapsible key={area.id} open={isOpen} onOpenChange={() => toggleArea(area.id)}>
                    <div className="rounded-lg border">
                      {/* Area header */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50">
                        {editingAreaId === area.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={editAreaName}
                              onChange={(e) => setEditAreaName(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => updateArea.mutate({ id: area.id, name: editAreaName })}
                              disabled={!editAreaName.trim() || updateArea.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingAreaId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <span className="flex-1 text-sm font-medium">{area.name}</span>
                            <span className="text-xs text-muted-foreground mr-1">
                              {areaIndicators.length} indicador{areaIndicators.length !== 1 ? "es" : ""}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => {
                                setEditingAreaId(area.id);
                                setEditAreaName(area.name);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => deleteArea.mutate(area.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Indicators list */}
                      <CollapsibleContent>
                        <div className="p-3 space-y-2 border-t">
                          {areaIndicators.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">Sin indicadores aún.</p>
                          )}

                          {areaIndicators.map((ind) => (
                            <div key={ind.id} className="flex items-start gap-2 pl-2">
                              {editingIndicatorId === ind.id ? (
                                <div className="flex-1 flex gap-2">
                                  <Textarea
                                    value={editIndicatorDesc}
                                    onChange={(e) => setEditIndicatorDesc(e.target.value)}
                                    rows={2}
                                    className="text-sm"
                                  />
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <Button
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => updateIndicator.mutate({ id: ind.id, description: editIndicatorDesc })}
                                      disabled={!editIndicatorDesc.trim() || updateIndicator.isPending}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingIndicatorId(null)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-muted-foreground mt-0.5">•</span>
                                  <p className="flex-1 text-sm">{ind.description}</p>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => {
                                      setEditingIndicatorId(ind.id);
                                      setEditIndicatorDesc(ind.description);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteIndicator.mutate(ind.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Add indicator input */}
                          <div className="flex gap-2 pt-1">
                            <Input
                              placeholder="Nuevo indicador..."
                              value={newIndicatorText[area.id] || ""}
                              onChange={(e) =>
                                setNewIndicatorText((prev) => ({ ...prev, [area.id]: e.target.value }))
                              }
                              className="text-sm h-8"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (newIndicatorText[area.id] || "").trim()) {
                                  addIndicator.mutate({ areaId: area.id, description: newIndicatorText[area.id] });
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 shrink-0"
                              onClick={() => addIndicator.mutate({ areaId: area.id, description: newIndicatorText[area.id] || "" })}
                              disabled={!(newIndicatorText[area.id] || "").trim() || addIndicator.isPending}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Agregar
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Add new area */}
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Nombre del área (ej: Lenguaje, Matemática...)"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newAreaName.trim()) addArea.mutate();
              }}
            />
            <Button
              onClick={() => addArea.mutate()}
              disabled={!newAreaName.trim() || addArea.isPending}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Área
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
