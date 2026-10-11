import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGradeCertificateSyncSource } from "@/hooks/useGradeCertificateSyncSource";
import {
  type CertificateInstitution,
  type GradeCertificateDocument,
  canAddInstitution,
  findOwnSchoolInstitution,
  institutionNumber,
} from "@/lib/grade-certificate";
import {
  type SyncCandidateGroup,
  applySync,
  buildSyncCandidates,
  defaultSyncSelection,
} from "@/lib/grade-certificate-sync";
import { gradeLabel } from "@/lib/gradeLevels";
import { SyncCandidateRow } from "./SyncCandidateRow";

interface SyncGradesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  draft: GradeCertificateDocument;
  ownSchool: Omit<CertificateInstitution, "id">;
  /** Receives the draft with the selected subjects written in, and how many were brought. */
  onApply: (next: GradeCertificateDocument, count: number) => void;
}

function ownSchoolNote(draft: GradeCertificateDocument, ownSchool: Omit<CertificateInstitution, "id">): string {
  const own = findOwnSchoolInstitution(draft.institutions);
  if (own) return `Las notas se asignarán a tu plantel (institución N° ${institutionNumber(draft.institutions, own.id)}).`;
  if (!canAddInstitution(draft.institutions)) {
    return "Ya hay 5 instituciones y ninguna es tu plantel: las notas llegarán sin institución.";
  }
  return ownSchool.name
    ? `Se agregará tu plantel (${ownSchool.name}) a las instituciones y las notas se le asignarán.`
    : "Se agregará tu plantel a las instituciones. Completa su nombre en Configuraciones › Datos comunes.";
}

/** "Sincronizar notas": pick which subjects to bring from the definitiva final into the draft. */
export function SyncGradesDialog({ open, onOpenChange, studentId, draft, ownSchool, onApply }: SyncGradesDialogProps) {
  const { data: source, isFetching: isLoading, error } = useGradeCertificateSyncSource(studentId, open);
  const groups = useMemo(() => (source ? buildSyncCandidates(source, draft) : []), [source, draft]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Each time the dialog loads, start from the suggested selection.
  useEffect(() => {
    if (open && source) setSelected(defaultSyncSelection(buildSyncCandidates(source, draft)));
    // The draft is read when the data arrives; later edits happen with the dialog closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const toggle = (keys: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
      return next;
    });

  const groupState = (group: SyncCandidateGroup): boolean | "indeterminate" => {
    const count = group.candidates.filter((c) => selected.has(c.key)).length;
    if (count === 0) return false;
    return count === group.candidates.length ? true : "indeterminate";
  };

  const hasCandidates = groups.some((g) => g.candidates.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronizar notas
          </DialogTitle>
          <DialogDescription>
            Elige qué traer de la definitiva final. Lo que marques pisa el nombre y la nota que haya en la
            certificación; lo demás no se toca.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Buscando las notas del estudiante…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{(error as Error).message}</p>
          ) : !hasCandidates ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Este estudiante no tiene materias de 1er a 5to año en el sistema. Carga sus notas a mano en el
              plan de estudio.
            </p>
          ) : (
            groups.filter((g) => g.candidates.length > 0).map((group) => (
              <section key={group.enrollmentId} className="rounded-lg border overflow-hidden">
                <header className="flex items-center gap-3 px-3 py-2 bg-muted/50">
                  <Checkbox
                    checked={groupState(group)}
                    onCheckedChange={(value) => toggle(group.candidates.map((c) => c.key), value === true)}
                    aria-label={`Seleccionar todo ${gradeLabel(group.gradeLevel)}`}
                  />
                  <p className="flex-1 text-sm font-semibold">
                    {gradeLabel(group.gradeLevel)}
                    <span className="font-normal text-muted-foreground">
                      {" "}· Sección {group.sectionName} · {group.yearRange}
                    </span>
                  </p>
                  {!group.isLatestForLevel && (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">Inscripción anterior</Badge>
                  )}
                </header>
                <div className="divide-y">
                  {group.candidates.map((candidate) => (
                    <SyncCandidateRow
                      key={candidate.key}
                      candidate={candidate}
                      checked={selected.has(candidate.key)}
                      onCheckedChange={(checked) => toggle([candidate.key], checked)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <DialogFooter className="sm:justify-between sm:items-center gap-3">
          <p className="text-xs text-muted-foreground sm:max-w-sm">
            {hasCandidates && ownSchoolNote(draft, ownSchool)}
          </p>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              disabled={selected.size === 0}
              onClick={() => {
                onApply(applySync(draft, groups, selected, ownSchool), selected.size);
                onOpenChange(false);
              }}
            >
              Traer {selected.size > 0 ? selected.size : ""} {selected.size === 1 ? "elemento" : "elementos"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
