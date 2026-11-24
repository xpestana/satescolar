import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sectionDisplayName } from "@/lib/gradeLevels";
import { SectionLetterInput } from "./SectionLetterInput";
import {
  categoryGradeLabel,
  gradeAllowsTechnical,
  type GradeCategory,
  type GradeLevel,
  type PendingSection,
  type SchoolSection,
} from "./sectionCategories";

/** What the modal was opened for: a whole category (accordion) or a single grade. */
export type SectionsModalTarget =
  | { kind: "category"; category: GradeCategory }
  | { kind: "grade"; grade: GradeLevel };

interface SectionsModalProps {
  target: SectionsModalTarget | null;
  onClose: () => void;
  schoolId: string | null;
  sections: SchoolSection[];
}

/** Create and edit the sections (letter + técnica flag) of one grade or category. */
export function SectionsModal({ target, onClose, schoolId, sections }: SectionsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionTechnical, setNewSectionTechnical] = useState(false);
  const [pendingSections, setPendingSections] = useState<Record<string, PendingSection[]>>({});
  const [activeGrade, setActiveGrade] = useState<string>("");
  const [editingSection, setEditingSection] = useState<SchoolSection | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTechnical, setEditingTechnical] = useState(false);

  // Reset everything each time the modal opens for a new target.
  useEffect(() => {
    setNewSectionName("");
    setNewSectionTechnical(false);
    setPendingSections({});
    setEditingSection(null);
    setEditingName("");
    setEditingTechnical(false);
    if (target?.kind === "category") setActiveGrade(target.category.levels[0]?.value || "");
    else if (target?.kind === "grade") setActiveGrade(target.grade);
    else setActiveGrade("");
  }, [target]);

  const getSectionsForGrade = (grade: GradeLevel) => sections.filter((s) => s.grade_level === grade);

  const createSectionsMutation = useMutation({
    mutationFn: async ({ grade, items }: { grade: GradeLevel; items: PendingSection[] }) => {
      if (!schoolId) throw new Error("No school selected");
      const allowTechnical = gradeAllowsTechnical(grade);
      const { error } = await supabase.from("sections").insert(
        items.map((item) => ({
          school_id: schoolId,
          grade_level: grade,
          name: item.name.trim().toUpperCase(),
          is_technical: allowTechnical && item.isTechnical,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast({ title: "Secciones creadas", description: "Las secciones se han creado correctamente." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Una o más secciones ya existen."
          : "No se pudieron crear las secciones.",
      });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ section, name, isTechnical }: { section: SchoolSection; name: string; isTechnical: boolean }) => {
      const { error } = await supabase
        .from("sections")
        .update({
          name: name.trim().toUpperCase(),
          is_technical: gradeAllowsTechnical(section.grade_level) && isTechnical,
        })
        .eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setEditingSection(null);
      setEditingName("");
      toast({ title: "Sección actualizada", description: "La sección se ha actualizado correctamente." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Ya existe una sección con ese nombre."
          : "No se pudo actualizar la sección.",
      });
    },
  });

  const addSectionToGrade = (grade: GradeLevel) => {
    const normalized = newSectionName.trim().toUpperCase();
    if (!normalized) return;
    if (!/^[A-Z]$/.test(normalized)) {
      toast({ variant: "destructive", title: "Formato inválido", description: "La sección debe ser una sola letra (A-Z)." });
      return;
    }
    const pending = pendingSections[grade] || [];
    if (pending.some((p) => p.name === normalized)) {
      toast({ variant: "destructive", title: "Error", description: "Ya agregaste esta sección." });
      return;
    }
    if (getSectionsForGrade(grade).some((s) => s.name === normalized)) {
      toast({ variant: "destructive", title: "Error", description: "Esta sección ya existe." });
      return;
    }
    const item: PendingSection = { name: normalized, isTechnical: gradeAllowsTechnical(grade) && newSectionTechnical };
    setPendingSections((prev) => ({ ...prev, [grade]: [...(prev[grade] || []), item] }));
    setNewSectionName("");
    setNewSectionTechnical(false);
  };

  const removePendingSection = (grade: string, name: string) => {
    setPendingSections((prev) => ({ ...prev, [grade]: (prev[grade] || []).filter((p) => p.name !== name) }));
  };

  const saveSectionsForGrade = (grade: GradeLevel) => {
    const items = pendingSections[grade];
    if (!items || items.length === 0) return;
    createSectionsMutation.mutate(
      { grade, items },
      {
        onSuccess: () =>
          setPendingSections((prev) => {
            const next = { ...prev };
            delete next[grade];
            return next;
          }),
      },
    );
  };

  const startEditing = (section: SchoolSection) => {
    setEditingSection(section);
    setEditingName(section.name);
    setEditingTechnical(!!section.is_technical);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditingName("");
  };

  const saveEditing = () => {
    if (!editingSection || !editingName.trim()) return;
    updateSectionMutation.mutate({ section: editingSection, name: editingName, isTechnical: editingTechnical });
  };

  const selectGrade = (grade: string) => {
    setActiveGrade(grade);
    setNewSectionName("");
    setNewSectionTechnical(false);
  };

  const renderPending = (grade: GradeLevel, label: string) => {
    const pending = pendingSections[grade] || [];
    if (pending.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        <Label className="w-full text-xs text-muted-foreground">{label}</Label>
        {pending.map((p) => (
          <Badge key={p.name} variant="default" className="gap-1">
            {sectionDisplayName({ name: p.name, is_technical: p.isTechnical })}
            <button type="button" onClick={() => removePendingSection(grade, p.name)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  };

  const renderExisting = (grade: GradeLevel, label: string) => {
    const existing = getSectionsForGrade(grade);
    if (existing.length === 0) return null;
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex flex-wrap gap-1">
          {existing.map((s) => (
            <Badge
              key={s.id}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => startEditing(s)}
            >
              {sectionDisplayName(s)}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const renderLetterInput = (grade: GradeLevel, autoFocus?: boolean) => (
    <SectionLetterInput
      id={`section-${grade}`}
      value={activeGrade === grade ? newSectionName : ""}
      onChange={(value) => {
        if (activeGrade !== grade) selectGrade(grade);
        setNewSectionName(value);
      }}
      isTechnical={activeGrade === grade && newSectionTechnical}
      onTechnicalChange={(value) => {
        if (activeGrade !== grade) selectGrade(grade);
        setNewSectionTechnical(value);
      }}
      allowTechnical={gradeAllowsTechnical(grade)}
      onAdd={() => addSectionToGrade(grade)}
      autoFocus={autoFocus}
    />
  );

  const title = editingSection
    ? "Modificar sección"
    : target?.kind === "category"
      ? `Agregar Secciones en ${target.category.category}`
      : "Agregar sección";

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="bg-primary -m-6 mb-4 p-6 rounded-t-lg">
          <DialogTitle className="text-white text-xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {editingSection ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="font-medium w-20">Grado:</Label>
                <span className="text-muted-foreground">{categoryGradeLabel(editingSection.grade_level)}</span>
              </div>
              <div className="flex items-center gap-4">
                <Label className="font-medium w-20">Sección:</Label>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                  maxLength={1}
                  className="h-9 text-center uppercase w-16"
                  autoFocus
                />
                {gradeAllowsTechnical(editingSection.grade_level) && (
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="editing-section-technical"
                      checked={editingTechnical}
                      onCheckedChange={(checked) => setEditingTechnical(checked === true)}
                    />
                    <Label htmlFor="editing-section-technical" className="text-sm font-normal cursor-pointer">
                      Técnica
                    </Label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={saveEditing}
                  disabled={updateSectionMutation.isPending || !editingName.trim()}
                >
                  {updateSectionMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          ) : target?.kind === "category" ? (
            <Accordion type="single" collapsible value={activeGrade} onValueChange={selectGrade}>
              {target.category.levels.map((grade) => {
                const gradeSections = getSectionsForGrade(grade.value);
                const hasPending = (pendingSections[grade.value] || []).length > 0;
                return (
                  <AccordionItem key={grade.value} value={grade.value}>
                    <AccordionTrigger className="text-sm py-3">
                      <div className="flex items-center gap-2">
                        {grade.label}
                        {gradeSections.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {gradeSections.map((s) => sectionDisplayName(s)).join(", ")}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">Sección:</Label>
                          {renderLetterInput(grade.value)}
                        </div>
                        {hasPending && (
                          <div className="space-y-2">
                            {renderPending(grade.value, "Por guardar:")}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveSectionsForGrade(grade.value)}
                              disabled={createSectionsMutation.isPending}
                            >
                              {createSectionsMutation.isPending ? "Guardando..." : "Guardar"}
                            </Button>
                          </div>
                        )}
                        {renderExisting(grade.value, "Existentes (clic para editar):")}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : target?.kind === "grade" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="font-medium w-20">Grado:</Label>
                <span className="text-muted-foreground">{categoryGradeLabel(target.grade)}</span>
              </div>
              <div className="flex items-center gap-4">
                <Label className="font-medium w-20">Sección:</Label>
                {renderLetterInput(target.grade, true)}
              </div>
              {renderPending(target.grade, "Secciones a crear:")}
              <div className="pt-2 border-t">{renderExisting(target.grade, "Secciones existentes (clic para editar):")}</div>
            </div>
          ) : null}
        </div>

        {!editingSection && target?.kind === "grade" && (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            {(pendingSections[target.grade] || []).length > 0 && (
              <Button
                type="button"
                onClick={() => saveSectionsForGrade(target.grade)}
                disabled={createSectionsMutation.isPending}
              >
                {createSectionsMutation.isPending ? "Guardando..." : "Guardar secciones"}
              </Button>
            )}
          </DialogFooter>
        )}

        {!editingSection && target?.kind === "category" && (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
