import { useCallback, useState } from "react";
import { GraduationCap } from "lucide-react";
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
import { useGradeCertificateStudents } from "@/hooks/useGradeCertificateStudents";
import type { CertificateStudent } from "@/lib/grade-certificate-students";
import { CertificateEditor } from "./CertificateEditor";
import { CertificateSchoolSettings } from "./CertificateSchoolSettings";
import { CertificateStudentPicker } from "./CertificateStudentPicker";

/**
 * Pestaña "Certificación de Notas" of /planillas: pick a student who studied 1er–5to año and
 * capture the data of their Certificación de Calificaciones EMG.
 */
export function GradeCertificateTab() {
  const { data: students = [], isLoading } = useGradeCertificateStudents();
  const [selected, setSelected] = useState<CertificateStudent | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  /** Student the user clicked while the current one had unsaved changes. */
  const [pending, setPending] = useState<CertificateStudent | null>(null);

  const handleDirtyChange = useCallback((dirty: boolean) => setIsDirty(dirty), []);

  const handleSelect = (student: CertificateStudent) => {
    if (student.studentId === selected?.studentId) return;
    if (isDirty) setPending(student);
    else setSelected(student);
  };

  return (
    <div className="space-y-4">
      <CertificateSchoolSettings />

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <CertificateStudentPicker
          students={students}
          isLoading={isLoading}
          selectedId={selected?.studentId ?? null}
          onSelect={handleSelect}
        />

        <div className="flex-1 min-w-0 w-full">
          {selected ? (
            <CertificateEditor key={selected.studentId} student={selected} onDirtyChange={handleDirtyChange} />
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 font-medium">Elige un estudiante</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                Busca al estudiante por nombre o cédula. Aparecen todos los que han cursado de 1er a 5to año,
                incluidos los egresados.
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Si cambias a {pending?.name} se perderán los cambios de {selected?.name} que no guardaste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSelected(pending);
                setPending(null);
              }}
            >
              Descartar y cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
