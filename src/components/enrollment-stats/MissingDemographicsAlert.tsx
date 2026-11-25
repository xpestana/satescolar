import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EnrollmentStats } from "@/lib/enrollmentStats/enrollmentStatsTypes";
import { NO_BIRTH_DATE_LABEL, UNKNOWN_SEX_LABEL } from "@/lib/enrollmentStats/reportTables";

interface Props {
  stats: EnrollmentStats;
}

/** Explains the "Sin fecha" row / "S/D" column: students whose form lacks birth date or sex. */
export function MissingDemographicsAlert({ stats }: Props) {
  if (!stats.hasUnknownAge && !stats.hasUnknownSex) return null;
  const withoutAge = stats.total.ages.find((a) => a.age === null)?.counts.total ?? 0;
  const withoutSex = stats.total.bySex.unknown;

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-600">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Hay estudiantes inscritos con datos incompletos</AlertTitle>
      <AlertDescription>
        {withoutAge > 0 && <span className="block">{withoutAge} sin fecha de nacimiento válida (fila "{NO_BIRTH_DATE_LABEL}").</span>}
        {withoutSex > 0 && <span className="block">{withoutSex} sin género registrado (columna "{UNKNOWN_SEX_LABEL}").</span>}
        <span className="block">Complételos en la ficha del estudiante para que el cuadro cuadre con la matrícula.</span>
      </AlertDescription>
    </Alert>
  );
}
