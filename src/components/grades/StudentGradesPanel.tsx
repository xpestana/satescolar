import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBoletaGradeValue } from "@/lib/gradeLiteral";
import type { StudentReportCard } from "@/hooks/useStudentReportCard";
import { MOMENTO_LABELS } from "@/hooks/useGradeVisibilitySettings";

/**
 * Read-only view of the grades a representative may see for one student, one school year and one
 * momento. Three shapes, one per level: numeric table for secondary, literal + written report for
 * primary, and written report only for preschool.
 */

interface StudentGradesPanelProps {
  reportCard: StudentReportCard;
  momento: number;
}

const STATUS_LABELS: Record<string, string> = {
  aprobado: "Aprobado",
  no_aprobado: "No Aprobado",
  no_cursante: "No Cursante",
  pp: "Pendiente por Presentar",
};

function EmptyState({ momento }: { momento: number }) {
  return (
    <div className="text-center py-10 border rounded-md bg-muted/20">
      <p className="text-muted-foreground">
        Todavía no hay notas cargadas para {MOMENTO_LABELS[momento]?.toLowerCase() || "este momento"}.
      </p>
    </div>
  );
}

export default function StudentGradesPanel({ reportCard, momento }: StudentGradesPanelProps) {
  const { levelKind, subjects, secondaryGrades, qualitativeReports } = reportCard;

  if (levelKind === "primary" || levelKind === "preschool") {
    const reports = qualitativeReports.filter((r) => r.momento === momento);
    if (reports.length === 0) return <EmptyState momento={momento} />;

    // The main report is written by the section's home teacher; the rest are the specialists.
    const ordered = [...subjects].sort(
      (a, b) => Number(b.isMainReport) - Number(a.isMainReport) || a.displayOrder - b.displayOrder,
    );

    return (
      <div className="space-y-4">
        {ordered.map((subject) => {
          const report = reports.find((r) => r.assignmentId === subject.assignmentId);
          if (!report) return null;
          return (
            <Card key={subject.assignmentId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">{subject.name}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {report.literal && (
                      <Badge variant="secondary">Calificación: {report.literal}</Badge>
                    )}
                    {report.finalStatus && (
                      <Badge variant="outline">{STATUS_LABELS[report.finalStatus] || report.finalStatus}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.descriptiveReport ? (
                  <div
                    className="prose prose-sm max-w-none text-sm leading-relaxed"
                    // The descriptive report is rich text written by the teacher in the school's
                    // own editor; it is stored as HTML and rendered as such in the boleta too.
                    dangerouslySetInnerHTML={{ __html: report.descriptiveReport }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Sin informe descriptivo.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Asistencias: {report.attendanceCount} · Inasistencias: {report.absenceCount}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  const grades = secondaryGrades.filter((g) => g.momento === momento);
  if (grades.length === 0) return <EmptyState momento={momento} />;

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Área / Materia</TableHead>
            <TableHead className="w-[110px] text-center">Nota</TableHead>
            <TableHead className="w-[130px] text-center">Inasistencias</TableHead>
            <TableHead className="w-[170px]">Condición</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map((subject) => {
            const grade = grades.find((g) => g.assignmentId === subject.assignmentId);
            const raw = grade?.gradeValue != null ? parseFloat(grade.gradeValue) : NaN;
            const value = Number.isNaN(raw)
              ? "—"
              : formatBoletaGradeValue(raw + (grade?.adjustmentPoints ?? 0), subject.evaluationType ?? undefined);
            return (
              <TableRow key={subject.assignmentId}>
                <TableCell className="font-medium">{subject.name}</TableCell>
                <TableCell className="text-center font-semibold">{value}</TableCell>
                <TableCell className="text-center">{grade?.absenceCount ?? 0}</TableCell>
                <TableCell>
                  {grade?.finalStatus ? (
                    <Badge variant="outline">{STATUS_LABELS[grade.finalStatus] || grade.finalStatus}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
