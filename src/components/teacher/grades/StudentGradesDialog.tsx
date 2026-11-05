import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { GradeStudent } from "@/hooks/useGradeStudents";
import {
  changedGrades,
  countFilledGrades,
  isAcceptedGradeInput,
  studentGradeValues,
  type GradeChange,
} from "@/lib/gradeEntry";

export interface GradePlanItem {
  id: string;
  description: string;
  percentage: number | null;
}

interface StudentGradesDialogProps {
  students: GradeStudent[];
  /** Position of the student being edited; `null` closes the dialog. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  planItems: GradePlanItem[];
  /** Saved grades of the sheet, `{ "<studentId>-<planItemId>": value }`. */
  grades: Record<string, string>;
  /** Bachillerato / GCRP: 1–20. Primaria and preescolar: free text. */
  numeric: boolean;
  momento: number;
  /** Persists the changed grades of one student; throws when something fails. */
  onSave: (studentId: string, changes: GradeChange[]) => Promise<void>;
}

/**
 * Phone dialog to enter every evaluation of the plan for one student. Changes are saved when
 * moving to another student or closing, like the desktop table saves on blur.
 */
export function StudentGradesDialog({
  students,
  index,
  onIndexChange,
  planItems,
  grades,
  numeric,
  momento,
  onSave,
}: StudentGradesDialogProps) {
  const student = index !== null ? students[index] : undefined;
  const planItemIds = useMemo(() => planItems.map((p) => p.id), [planItems]);
  const saved = useMemo(
    () => (student ? studentGradeValues(grades, student.student_id, planItemIds) : {}),
    [grades, student, planItemIds],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fieldRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);

  // Start from the saved grades each time another student is opened.
  const studentId = student?.student_id;
  useEffect(() => {
    if (studentId) setDraft(saved);
    // Only when the student changes: a refetch must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (!student || index === null) return null;

  const changes = changedGrades(draft, saved, planItemIds);
  const dirty = changes.length > 0;
  const filled = countFilledGrades(draft, planItemIds);
  const isLast = index === students.length - 1;

  const persist = async (): Promise<boolean> => {
    if (!dirty) return true;
    setSaving(true);
    try {
      await onSave(student.student_id, changes);
      return true;
    } catch {
      toast.error("No se pudieron guardar las notas", { description: "Revisa tu conexión e inténtalo de nuevo." });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goTo = async (next: number | null) => {
    if (saving) return;
    if (await persist()) onIndexChange(next);
  };

  const handleChange = (planItemId: string, value: string) => {
    if (!isAcceptedGradeInput(value, numeric)) return;
    setDraft((d) => ({ ...d, [planItemId]: value }));
  };

  const focusNextField = (i: number) => {
    const next = fieldRefs.current[i + 1];
    if (next) next.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) void goTo(null); }}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg [&>button]:hidden">
        {/* Header: who, progress and navigation */}
        <div className="flex shrink-0 items-start gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm leading-snug">{student.full_name}</DialogTitle>
            <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>C.I. {student.document_id || "—"}</span>
              <span>·</span>
              <span>Momento {momento}</span>
              <span>·</span>
              <span>{index + 1} de {students.length}</span>
            </DialogDescription>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={index === 0 || saving}
            onClick={() => void goTo(index - 1)} aria-label="Estudiante anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isLast || saving}
            onClick={() => void goTo(index + 1)} aria-label="Estudiante siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={saving}
            onClick={() => void goTo(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {numeric ? "Notas del 1 al 20" : "Notas descriptivas"} · {filled} de {planItems.length} cargadas
          </span>
          {dirty ? (
            <Badge variant="outline" className="h-5 border-amber-300 text-[10px] text-amber-700">Sin guardar</Badge>
          ) : (
            <Badge variant="outline" className="h-5 border-emerald-300 text-[10px] text-emerald-700">Guardado</Badge>
          )}
        </div>

        {/* One field per evaluation of the plan */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {planItems.map((pi, i) => {
            const fieldId = `grade-${pi.id}`;
            return (
              <div key={pi.id} className="space-y-1.5">
                <Label htmlFor={fieldId} className="flex items-start justify-between gap-2 text-sm font-medium leading-snug">
                  <span>{pi.description}</span>
                  {pi.percentage != null && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{pi.percentage}%</Badge>
                  )}
                </Label>
                {numeric ? (
                  <Input
                    id={fieldId}
                    ref={(el) => { fieldRefs.current[i] = el; }}
                    type="number"
                    inputMode="decimal"
                    enterKeyHint={i === planItems.length - 1 ? "done" : "next"}
                    min={1}
                    max={20}
                    value={draft[pi.id] ?? ""}
                    onChange={(e) => handleChange(pi.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); focusNextField(i); }
                    }}
                    className="h-11 text-center text-lg font-semibold"
                    placeholder="—"
                  />
                ) : (
                  <Textarea
                    id={fieldId}
                    ref={(el) => { fieldRefs.current[i] = el; }}
                    value={draft[pi.id] ?? ""}
                    onChange={(e) => handleChange(pi.id, e.target.value)}
                    className="min-h-[96px] text-sm"
                    placeholder="Escribir nota descriptiva..."
                  />
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Los cambios se guardan al pasar a otro estudiante o al cerrar.
          </p>
        </div>

        {/* Footer: full width actions */}
        <div className="flex shrink-0 gap-2 border-t px-3 py-2.5">
          <Button variant="outline" className="flex-1" disabled={saving} onClick={() => void goTo(null)}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {dirty ? "Guardar" : "Cerrar"}
          </Button>
          <Button className="flex-1" disabled={saving || (isLast && !dirty)} onClick={() => void goTo(isLast ? null : index + 1)}>
            {isLast ? (dirty ? "Guardar y terminar" : "Siguiente") : dirty ? "Guardar y siguiente" : "Siguiente"}
            {!isLast && <ChevronRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
