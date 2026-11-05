import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileText, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { GradeStudent } from "@/hooks/useGradeStudents";

export interface ReportCardEntry {
  literal: string;
  attendance_count: number;
  absence_count: number;
  final_status: string;
}

const LITERALS = ["A", "B", "C", "D", "E"];

interface ReportCardEntryDialogProps {
  students: GradeStudent[];
  /** Position of the student being edited; `null` closes the dialog. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  momento: number;
  /** "Primaria" / "Preescolar", shown in the header. */
  levelLabel: string;
  statusOptions: { value: string; label: string }[];
  /** Values as last saved for a student. */
  savedEntry: (studentId: string) => ReportCardEntry;
  hasReport: (studentId: string) => boolean;
  /** Persists one student's entry; throws when something fails. */
  onSave: (studentId: string, entry: ReportCardEntry) => Promise<void>;
  /** Opens the descriptive report editor of a student (the dialog closes first). */
  onOpenReport: (student: GradeStudent) => void;
}

function sameEntry(a: ReportCardEntry, b: ReportCardEntry): boolean {
  return a.literal === b.literal &&
    a.attendance_count === b.attendance_count &&
    a.absence_count === b.absence_count &&
    a.final_status === b.final_status;
}

/**
 * Phone dialog with the report-card fields of a primary / preschool student (literal,
 * attendance and status) plus a shortcut to the descriptive report. Saved when moving to another
 * student or closing, like the desktop table saves on blur.
 */
export function ReportCardEntryDialog({
  students,
  index,
  onIndexChange,
  momento,
  levelLabel,
  statusOptions,
  savedEntry,
  hasReport,
  onSave,
  onOpenReport,
}: ReportCardEntryDialogProps) {
  const student = index !== null ? students[index] : undefined;
  const [draft, setDraft] = useState<ReportCardEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const studentId = student?.student_id;
  useEffect(() => {
    if (studentId) setDraft(savedEntry(studentId));
    // Only when the student changes: a refetch must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (!student || index === null || !draft) return null;

  const saved = savedEntry(student.student_id);
  const dirty = !sameEntry(draft, saved);
  const isLast = index === students.length - 1;
  const set = (patch: Partial<ReportCardEntry>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const persist = async (): Promise<boolean> => {
    if (!dirty) return true;
    setSaving(true);
    try {
      await onSave(student.student_id, draft);
      return true;
    } catch {
      toast.error("No se pudo guardar la boleta", { description: "Revisa tu conexión e inténtalo de nuevo." });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goTo = async (next: number | null) => {
    if (saving) return;
    if (await persist()) onIndexChange(next);
  };

  const openReport = async () => {
    if (saving) return;
    if (await persist()) {
      onIndexChange(null);
      onOpenReport(student);
    }
  };

  const countInput = (field: "attendance_count" | "absence_count", label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`rc-${field}`} className="text-sm">{label}</Label>
      <Input
        id={`rc-${field}`}
        type="number"
        inputMode="numeric"
        min={0}
        value={draft[field]}
        onChange={(e) => set({ [field]: Math.max(0, parseInt(e.target.value) || 0) })}
        className="h-11 text-center text-lg"
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) void goTo(null); }}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg [&>button]:hidden">
        <div className="flex shrink-0 items-start gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm leading-snug">{student.full_name}</DialogTitle>
            <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>C.I. {student.document_id || "—"}</span>
              <span>·</span>
              <span>Boleta {levelLabel} · Momento {momento}</span>
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

        <div className="flex shrink-0 justify-end border-b bg-muted/40 px-3 py-2">
          {dirty ? (
            <Badge variant="outline" className="h-5 border-amber-300 text-[10px] text-amber-700">Sin guardar</Badge>
          ) : (
            <Badge variant="outline" className="h-5 border-emerald-300 text-[10px] text-emerald-700">Guardado</Badge>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          <Button variant="outline" className="h-11 w-full justify-start" disabled={saving} onClick={() => void openReport()}>
            <FileText className={`mr-2 h-4 w-4 ${hasReport(student.student_id) ? "text-primary" : ""}`} />
            {hasReport(student.student_id) ? "Editar informe descriptivo" : "Redactar informe descriptivo"}
          </Button>

          <div className="space-y-1.5">
            <Label className="text-sm">Literal</Label>
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Literal">
              {LITERALS.map((l) => (
                <Button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={draft.literal === l}
                  variant={draft.literal === l ? "default" : "outline"}
                  className="h-11 text-base font-semibold"
                  onClick={() => set({ literal: draft.literal === l ? "" : l })}
                >
                  {l}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-xs text-muted-foreground"
                disabled={!draft.literal}
                onClick={() => set({ literal: "" })}
              >
                Quitar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {countInput("attendance_count", "Asistencias")}
            {countInput("absence_count", "Inasistencias")}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Estado</Label>
            <Select value={draft.final_status} onValueChange={(v) => set({ final_status: v })}>
              <SelectTrigger className="h-11" aria-label="Estado">
                <SelectValue placeholder="Sin estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Los cambios se guardan al pasar a otro estudiante o al cerrar.
          </p>
        </div>

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
