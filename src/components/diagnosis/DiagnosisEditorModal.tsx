import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Eye, Loader2, PenLine, Save, X } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/utilities/RichTextEditor";
import DiagnosisHtmlPreview from "@/components/diagnosis/DiagnosisHtmlPreview";
import { useDiagnosisContext } from "@/hooks/useDiagnosisContext";
import { useSaveDiagnosis } from "@/hooks/useSaveDiagnosis";
import type { StudentDiagnosis } from "@/hooks/useStudentDiagnoses";
import type { GradeStudent } from "@/hooks/useGradeStudents";
import { DIAGNOSIS_SECTION_TITLES, DiagnosisSections } from "@/lib/diagnosisSheet";
import { composeDiagnosisDocument } from "@/lib/diagnosisSheetData";
import { isRichTextEmpty } from "@/lib/richTextSanitize";

/** New sections start as a bullet list, like the paper sheet. */
const EMPTY_SECTION = "<ul><li><br></li></ul>";

const SECTION_HINTS: Record<keyof DiagnosisSections, string> = {
  strengths: "Lo que el estudiante ya logra. Ej.: Reconoce vocales y consonantes.",
  weaknesses: "Lo que aún le cuesta. Ej.: Se encuentra en proceso de adaptación.",
  improvements: "Lo que se trabajará. Ej.: Reforzar el proceso de lectura.",
};

const SECTION_KEYS: (keyof DiagnosisSections)[] = ["strengths", "weaknesses", "improvements"];

const sameText = (a: string, b: string) => a === b || (isRichTextEmpty(a) && isRichTextEmpty(b));

function draftFrom(saved: StudentDiagnosis | undefined): DiagnosisSections {
  return {
    strengths: saved?.strengths || EMPTY_SECTION,
    weaknesses: saved?.weaknesses || EMPTY_SECTION,
    improvements: saved?.improvements || EMPTY_SECTION,
  };
}

/** What is stored: an untouched section is saved empty, not as an empty bullet. */
const toStored = (draft: DiagnosisSections): DiagnosisSections => ({
  strengths: isRichTextEmpty(draft.strengths) ? "" : draft.strengths,
  weaknesses: isRichTextEmpty(draft.weaknesses) ? "" : draft.weaknesses,
  improvements: isRichTextEmpty(draft.improvements) ? "" : draft.improvements,
});

type PendingAction = { type: "close" } | { type: "go"; index: number };

interface DiagnosisEditorModalProps {
  open: boolean;
  onClose: () => void;
  assignmentId: string;
  schoolId: string;
  students: GradeStudent[];
  index: number;
  onIndexChange: (index: number) => void;
  diagnoses: Record<string, StudentDiagnosis>;
}

export default function DiagnosisEditorModal({
  open,
  onClose,
  assignmentId,
  schoolId,
  students,
  index,
  onIndexChange,
  diagnoses,
}: DiagnosisEditorModalProps) {
  const student = students[index];
  const saved = student ? diagnoses[student.student_id] : undefined;
  const [draft, setDraft] = useState<DiagnosisSections>(() => draftFrom(saved));
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const saveMut = useSaveDiagnosis(assignmentId, schoolId);

  const studentIds = useMemo(() => students.map((s) => s.student_id), [students]);
  const { data: context, isLoading: contextLoading } = useDiagnosisContext(assignmentId, studentIds, open);

  // Load the student's saved text when the student changes. Not on every refetch of `diagnoses`,
  // so saving doesn't reset the editor under the cursor.
  useEffect(() => {
    setDraft(draftFrom(saved));
    setMobileView("edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.student_id, open]);

  const dirty = SECTION_KEYS.some((key) => !sameText(draft[key], saved?.[key] ?? ""));

  // Debounced live preview, composed locally from the loaded context.
  useEffect(() => {
    if (!open || !context || !student) return;
    const timer = setTimeout(() => {
      setPreviewHtml(
        composeDiagnosisDocument(
          context,
          [{ studentId: student.student_id, studentName: student.full_name, documentId: student.document_id }],
          { [student.student_id]: toStored(draft) },
        ),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [open, context, student, draft]);

  const save = useCallback(async () => {
    if (!student) return false;
    try {
      await saveMut.mutateAsync({ studentId: student.student_id, ...toStored(draft) });
      toast.success("Diagnóstico guardado");
      return true;
    } catch {
      return false;
    }
  }, [draft, saveMut, student]);

  const runAction = (action: PendingAction) => {
    if (action.type === "close") onClose();
    else onIndexChange(action.index);
  };

  /** Leaving the student with unsaved changes asks first. */
  const request = (action: PendingAction) => {
    if (dirty) setPending(action);
    else runAction(action);
  };

  const saveAndNext = async () => {
    const ok = await save();
    if (!ok) return;
    if (index < students.length - 1) onIndexChange(index + 1);
    else onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (dirty && !saveMut.isPending) save();
    }
  };

  if (!student) return null;
  const isLast = index === students.length - 1;
  const hasSaved = !!saved;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) request({ type: "close" }); }}>
        <DialogContent
          onKeyDown={onKeyDown}
          className="w-screen max-w-none h-[100dvh] sm:w-[96vw] sm:h-[94vh] sm:rounded-lg p-0 gap-0 flex flex-col [&>button]:hidden"
        >
          {/* Header: who, where in the list, and navigation */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5 sm:px-4 shrink-0">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-sm sm:text-base">{student.full_name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span>Diagnóstico · {index + 1} de {students.length}</span>
                {dirty ? (
                  <Badge variant="outline" className="h-5 border-amber-300 text-amber-700 text-[10px]">Sin guardar</Badge>
                ) : hasSaved ? (
                  <Badge variant="outline" className="h-5 border-emerald-300 text-emerald-700 text-[10px]">Guardado</Badge>
                ) : (
                  <Badge variant="outline" className="h-5 text-[10px]">Pendiente</Badge>
                )}
              </DialogDescription>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={index === 0}
              onClick={() => request({ type: "go", index: index - 1 })} aria-label="Estudiante anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={isLast}
              onClick={() => request({ type: "go", index: index + 1 })} aria-label="Estudiante siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => request({ type: "close" })} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Phone: switch between writing and the preview */}
          <div className="grid grid-cols-2 gap-1 border-b bg-muted/40 p-1 md:hidden shrink-0">
            {([["edit", "Redactar", PenLine], ["preview", "Vista previa", Eye]] as const).map(([view, label, Icon]) => (
              <button
                key={view}
                type="button"
                onClick={() => setMobileView(view)}
                className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
                  mobileView === view ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 md:grid-cols-2">
            <div className={`min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4 ${mobileView === "preview" ? "hidden md:block" : ""}`}>
              {SECTION_KEYS.map((key) => (
                <section key={key} className="space-y-1.5">
                  <div>
                    <h3 className="text-sm font-semibold">{DIAGNOSIS_SECTION_TITLES[key]}</h3>
                    <p className="text-xs text-muted-foreground">{SECTION_HINTS[key]}</p>
                  </div>
                  <RichTextEditor
                    value={draft[key]}
                    onChange={(html) => setDraft((d) => ({ ...d, [key]: html }))}
                    placeholder="Escribe aquí…"
                    minHeight={130}
                  />
                </section>
              ))}
              <p className="text-xs text-muted-foreground">
                Una sección vacía no se imprime. Atajo: <kbd className="rounded border px-1">Ctrl</kbd>+<kbd className="rounded border px-1">S</kbd> para guardar.
              </p>
            </div>
            <div className={`min-h-0 overflow-y-auto bg-muted/40 p-3 sm:p-4 md:border-l ${mobileView === "edit" ? "hidden md:block" : ""}`}>
              <DiagnosisHtmlPreview html={previewHtml} loading={contextLoading} />
            </div>
          </div>

          {/* Footer: save actions, full width on phones */}
          <div className="flex flex-col-reverse gap-2 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:justify-end sm:px-4 shrink-0">
            <Button variant="outline" disabled={!dirty || saveMut.isPending} onClick={save}>
              {saveMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Guardar
            </Button>
            <Button disabled={saveMut.isPending || (!dirty && isLast)} onClick={dirty ? saveAndNext : () => onIndexChange(index + 1)}>
              {dirty ? (isLast ? "Guardar y terminar" : "Guardar y siguiente") : "Siguiente"}
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              El diagnóstico de {student.full_name} tiene cambios que aún no se guardaron.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <Button variant="outline" onClick={() => { const a = pending!; setPending(null); runAction(a); }}>
              Descartar
            </Button>
            <AlertDialogAction
              onClick={async () => {
                const a = pending!;
                setPending(null);
                if (await save()) runAction(a);
              }}
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
