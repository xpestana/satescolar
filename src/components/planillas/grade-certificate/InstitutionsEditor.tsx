import { useState } from "react";
import { ArrowDown, ArrowUp, Building2, Plus, School, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  type CertificateInstitution,
  type GradeCertificateDocument,
  MAX_CERTIFICATE_INSTITUTIONS,
  addInstitution,
  canAddInstitution,
  countGradesOfInstitution,
  findOwnSchoolInstitution,
  moveInstitution,
  removeInstitution,
} from "@/lib/grade-certificate";
import { CertificateTextInput } from "./CertificateTextInput";

interface InstitutionsEditorProps {
  document: GradeCertificateDocument;
  updateDraft: (update: (draft: GradeCertificateDocument) => GradeCertificateDocument) => void;
  /** The issuing school, from Planillas → Datos comunes, for the "Agregar mi plantel" shortcut. */
  ownSchool: Omit<CertificateInstitution, "id">;
}

/** "Instituciones Educativas donde Cursó Estudios": free text, numbered by position. */
export function InstitutionsEditor({ document, updateDraft, ownSchool }: InstitutionsEditorProps) {
  const { institutions } = document;
  const [pendingRemoval, setPendingRemoval] = useState<CertificateInstitution | null>(null);
  // The row added last gets the focus so the user can type right away.
  const [focusLast, setFocusLast] = useState(false);

  const canAdd = canAddInstitution(institutions);
  const hasOwnSchool = !!findOwnSchoolInstitution(institutions);

  const add = (institution?: Omit<CertificateInstitution, "id">) => {
    setFocusLast(!institution);
    updateDraft((draft) => addInstitution(draft, institution));
  };

  const patch = (id: string, changes: Partial<CertificateInstitution>) =>
    updateDraft((draft) => ({
      ...draft,
      institutions: draft.institutions.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    }));

  const requestRemoval = (institution: CertificateInstitution) => {
    if (countGradesOfInstitution(document, institution.id) > 0) setPendingRemoval(institution);
    else updateDraft((draft) => removeInstitution(draft, institution.id));
  };

  const addButtons = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => add()} disabled={!canAdd}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Agregar institución
      </Button>
      {!hasOwnSchool && (
        <Button variant="outline" size="sm" onClick={() => add(ownSchool)} disabled={!canAdd}>
          <School className="h-3.5 w-3.5 mr-1.5" />
          Agregar mi plantel
        </Button>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Instituciones donde cursó estudios
            </CardTitle>
            <CardDescription>
              En el orden en que saldrán en la planilla. Cada nota indica el N° de su institución.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {institutions.length} de {MAX_CERTIFICATE_INSTITUTIONS}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {institutions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Todavía no hay instituciones. Agrega tu plantel y, si el estudiante viene de otro colegio,
              los planteles donde cursó los años anteriores.
            </p>
            <div className="flex justify-center">{addButtons}</div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border divide-y">
              <div className="hidden md:grid grid-cols-[2.5rem_1fr_11rem_4.5rem_6.5rem] gap-2 px-2 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground">
                <span className="text-center">N°</span>
                <span className="px-2">Denominación y epónimo</span>
                <span className="px-2">Localidad</span>
                <span className="px-2">E.F.</span>
                <span />
              </div>
              {institutions.map((institution, index) => (
                <div
                  key={institution.id}
                  className="grid grid-cols-1 md:grid-cols-[2.5rem_1fr_11rem_4.5rem_6.5rem] gap-2 items-center px-2 py-1.5"
                >
                  <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <CertificateTextInput
                      value={institution.name}
                      onValueChange={(name) => patch(institution.id, { name })}
                      placeholder="Ej. UNIDAD EDUCATIVA MI ESCUELA"
                      aria-label={`Denominación de la institución ${index + 1}`}
                      autoFocus={focusLast && index === institutions.length - 1}
                      className="h-8 text-sm"
                    />
                    {institution.isOwnSchool && (
                      <Badge variant="outline" className="shrink-0 text-[10px] text-primary border-primary/40">
                        Mi plantel
                      </Badge>
                    )}
                  </div>
                  <CertificateTextInput
                    value={institution.locality}
                    onValueChange={(locality) => patch(institution.id, { locality })}
                    placeholder="Localidad"
                    aria-label={`Localidad de la institución ${index + 1}`}
                    className="h-8 text-sm"
                  />
                  <CertificateTextInput
                    value={institution.federalEntity}
                    onValueChange={(federalEntity) => patch(institution.id, { federalEntity })}
                    placeholder="E.F."
                    maxLength={3}
                    aria-label={`Entidad federal de la institución ${index + 1}`}
                    className="h-8 text-sm text-center"
                  />
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Subir"
                      disabled={index === 0}
                      onClick={() => updateDraft((draft) => moveInstitution(draft, institution.id, "up"))}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Bajar"
                      disabled={index === institutions.length - 1}
                      onClick={() => updateDraft((draft) => moveInstitution(draft, institution.id, "down"))}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Quitar institución"
                      onClick={() => requestRemoval(institution)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {addButtons}
              {!canAdd && (
                <p className="text-xs text-muted-foreground">
                  La planilla admite hasta {MAX_CERTIFICATE_INSTITUTIONS} instituciones.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={!!pendingRemoval} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta institución?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval && (
                <>
                  <strong>{pendingRemoval.name || "Institución sin nombre"}</strong> está asignada a{" "}
                  {countGradesOfInstitution(document, pendingRemoval.id)} nota(s). Esas notas quedarán sin
                  institución y las demás instituciones se renumerarán.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoval) updateDraft((draft) => removeInstitution(draft, pendingRemoval.id));
                setPendingRemoval(null);
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
