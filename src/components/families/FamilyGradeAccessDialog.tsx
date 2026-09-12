import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import StudentGradeAccessToggle from "@/components/students/StudentGradeAccessToggle";
import { useStudentGradeBlock } from "@/hooks/useStudentGradeBlock";

/**
 * Grade / boleta block for the students of ONE family, opened from the actions column of
 * Registros > Familias.
 *
 * The block is per student, not per family: a family can have several children and the school
 * usually needs to block only one of them, so the dialog lists every student of the family with
 * its own switch instead of applying a single decision to the whole family.
 */

export interface FamilyStudentOption {
  id: string;
  name: string;
}

interface FamilyGradeAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string | null | undefined;
  familyName: string;
  students: FamilyStudentOption[];
}

export default function FamilyGradeAccessDialog({
  open,
  onOpenChange,
  schoolId,
  familyName,
  students,
}: FamilyGradeAccessDialogProps) {
  const studentIds = students.map((s) => s.id);
  const { isBlocked, setBlocked, isLoading } = useStudentGradeBlock(schoolId, studentIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Acceso a las notas y boletas de la familia {familyName}</DialogTitle>
          <DialogDescription>
            Elija el estudiante al que desea bloquear el acceso. El bloqueo aplica solo a ese
            estudiante, en todos los años escolares y momentos, y el representante deja de ver sus
            notas y de poder descargar su boleta.
          </DialogDescription>
        </DialogHeader>

        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Esta familia no tiene estudiantes registrados.
          </p>
        ) : isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="divide-y rounded-md border">
            {students.map((student) => (
              <div key={student.id} className="flex items-center justify-between gap-3 p-3">
                <p className="text-sm font-medium truncate">{student.name}</p>
                <StudentGradeAccessToggle
                  variant="switch"
                  studentName={student.name}
                  isBlocked={isBlocked(student.id)}
                  disabled={setBlocked.isPending}
                  onToggle={(blocked) => setBlocked.mutate({ studentId: student.id, blocked })}
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
