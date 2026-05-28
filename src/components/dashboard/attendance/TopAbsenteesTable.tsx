import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import type { TopAbsentee } from "@/hooks/useSchoolAttendance";

interface Props {
  data: TopAbsentee[] | undefined;
  isLoading: boolean;
}

function severityVariant(rate: number): "destructive" | "secondary" | "outline" {
  if (rate >= 30) return "destructive";
  if (rate >= 15) return "secondary";
  return "outline";
}

export function TopAbsenteesTable({ data, isLoading }: Props) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Estudiantes con más inasistencias
        </CardTitle>
        <p className="text-xs text-muted-foreground">Top 10 en el período seleccionado</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Sin inasistencias en el período seleccionado
          </div>
        ) : (
          <ol className="space-y-2">
            {data.map((student, index) => (
              <li
                key={student.studentId}
                className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-muted-foreground w-5 shrink-0">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-medium truncate">{student.fullName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {student.absences}/{student.total}
                  </span>
                  <Badge variant={severityVariant(student.rate)}>
                    {student.rate}% ausencias
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
