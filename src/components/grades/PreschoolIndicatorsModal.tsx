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
import { Skeleton } from "@/components/ui/skeleton";

const LEVELS = [
  { value: "prematernal", label: "Prematernal" },
  { value: "1", label: "1er Nivel" },
  { value: "2", label: "2do Nivel" },
  { value: "3", label: "3er Nivel" },
];

const MOMENTOS = [
  { value: "1", label: "1er Momento" },
  { value: "2", label: "2do Momento" },
  { value: "3", label: "3er Momento" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  showIndicators?: boolean;
}

interface Component {
  id: string;
  level: string;
  momento: string;
  name: string;
  display_order: number;
}

interface Indicator {
  id: string;
  component_id: string;
  description: string;
  display_order: number;
}

export function PreschoolIndicatorsModal({ open, onOpenChange, schoolId, showIndicators = true }: Props) {
  const queryClient = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState("prematernal");
  const [selectedMomento, setSelectedMomento] = useState("1");
  const [newComponentName, setNewComponentName] = useState("");
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editComponentName, setEditComponentName] = useState("");
  const [newIndicatorText, setNewIndicatorText] = useState<Record<string, string>>({});
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [editIndicatorDesc, setEditIndicatorDesc] = useState("");
  const [openComponents, setOpenComponents] = useState<Set<string>>(new Set());

  const componentsKey = ["preschool-components", schoolId];
  const indicatorsKey = ["preschool-indicators", schoolId];

  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: componentsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preschool_indicator_components")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data as Component[];
    },
    enabled: open && !!schoolId,
  });

  const { data: indicators = [], isLoading: indicatorsLoading } = useQuery({
    queryKey: indicatorsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preschool_component_indicators")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data as Indicator[];
    },
    enabled: open && !!schoolId,
  });

  const filteredComponents = components.filter(
    (c) => c.level === selectedLevel && c.momento === selectedMomento
  );
  const getIndicatorsForComponent = (componentId: string) =>
    indicators.filter((i) => i.component_id === componentId);

  const toggleComponent = (id: string) => {
    setOpenComponents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Component mutations ---
  const addComponent = useMutation({
    mutationFn: async () => {
      const maxOrder = filteredComponents.length > 0 ? Math.max(...filteredComponents.map((c) => c.display_order)) + 1 : 0;
      const { error } = await supabase.from("preschool_indicator_components").insert({
        school_id: schoolId,
        level: selectedLevel,
        momento: selectedMomento,
        name: newComponentName.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: componentsKey });
      setNewComponentName("");
      toast.success("Componente agregado");
    },
    onError: () => toast.error("Error al agregar componente"),
  });

  const updateComponent = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("preschool_indicator_components")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: componentsKey });
      setEditingComponentId(null);
      toast.success("Componente actualizado");
    },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteComponent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("preschool_indicator_components").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: componentsKey });
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      toast.success("Componente eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  // --- Indicator mutations ---
  const addIndicator = useMutation({
    mutationFn: async ({ componentId, description }: { componentId: string; description: string }) => {
      const compIndicators = getIndicatorsForComponent(componentId);
      const maxOrder = compIndicators.length > 0 ? Math.max(...compIndicators.map((i) => i.display_order)) + 1 : 0;
      const { error } = await supabase.from("preschool_component_indicators").insert({
        school_id: schoolId,
        component_id: componentId,
        description: description.trim(),
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: (_, { componentId }) => {
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      setNewIndicatorText((prev) => ({ ...prev, [componentId]: "" }));
      toast.success("Indicador agregado");
    },
    onError: () => toast.error("Error al agregar indicador"),
  });

  const updateIndicator = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const { error } = await supabase
        .from("preschool_component_indicators")
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
      const { error } = await supabase.from("preschool_component_indicators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: indicatorsKey });
      toast.success("Indicador eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const isLoading = componentsLoading || indicatorsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Componentes de Preescolar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Level + Momento selectors */}
          <div className="grid grid-cols-2 gap-3">
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMomento} onValueChange={setSelectedMomento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOMENTOS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredComponents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay componentes para este nivel/momento. Agrega uno abajo.
                </p>
              )}

              {filteredComponents.map((comp) => {
                const compIndicators = getIndicatorsForComponent(comp.id);
                const isOpen = openComponents.has(comp.id);

                return (
                  <Collapsible key={comp.id} open={isOpen} onOpenChange={() => toggleComponent(comp.id)}>
                    <div className="rounded-lg border">
                      {/* Component header */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50">
                        {editingComponentId === comp.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={editComponentName}
                              onChange={(e) => setEditComponentName(e.target.value)}
                              className="h-8"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => updateComponent.mutate({ id: comp.id, name: editComponentName })}
                              disabled={!editComponentName.trim() || updateComponent.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingComponentId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                          {showIndicators && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                            <span className="flex-1 text-sm font-medium">{comp.name}</span>
                            {showIndicators && (
                              <span className="text-xs text-muted-foreground mr-1">
                                {compIndicators.length} indicador{compIndicators.length !== 1 ? "es" : ""}
                              </span>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => {
                                setEditingComponentId(comp.id);
                                setEditComponentName(comp.name);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => deleteComponent.mutate(comp.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Indicators list - only when showIndicators */}
                      {showIndicators && (
                        <CollapsibleContent>
                          <div className="p-3 space-y-2 border-t">
                            {compIndicators.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Sin indicadores aún.</p>
                            )}

                            {compIndicators.map((ind) => (
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
                                value={newIndicatorText[comp.id] || ""}
                                onChange={(e) =>
                                  setNewIndicatorText((prev) => ({ ...prev, [comp.id]: e.target.value }))
                                }
                                className="text-sm h-8"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (newIndicatorText[comp.id] || "").trim()) {
                                    addIndicator.mutate({ componentId: comp.id, description: newIndicatorText[comp.id] });
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 shrink-0"
                                onClick={() => addIndicator.mutate({ componentId: comp.id, description: newIndicatorText[comp.id] || "" })}
                                disabled={!(newIndicatorText[comp.id] || "").trim() || addIndicator.isPending}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Agregar
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Add new component */}
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Nombre del componente (ej: Formación Personal...)"
              value={newComponentName}
              onChange={(e) => setNewComponentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newComponentName.trim()) addComponent.mutate();
              }}
            />
            <Button
              onClick={() => addComponent.mutate()}
              disabled={!newComponentName.trim() || addComponent.isPending}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Componente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
