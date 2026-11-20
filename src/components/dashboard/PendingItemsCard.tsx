import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Info, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useDashboardPendingItems } from "@/hooks/useDashboardPendingItems";

interface Props {
  schoolId: string | null;
  activeSchoolYearId: string | null;
  /** False when the school has no module that uses teachers (see TEACHING_MODULES). */
  includeTeaching?: boolean;
}

export function PendingItemsCard({ schoolId, activeSchoolYearId, includeTeaching = true }: Props) {
  const { data: items, isLoading, isError } = useDashboardPendingItems(
    schoolId,
    activeSchoolYearId,
    includeTeaching,
  );

  const hasPending = items && items.length > 0;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          {hasPending || isError ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          Pendientes por Atender
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>No se pudieron cargar los pendientes. Recarga la página para intentarlo de nuevo.</span>
          </div>
        ) : !hasPending ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>No hay pendientes. Todo está en orden.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => {
              const content = (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg p-3 text-sm transition-colors",
                    item.type === "warning"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-blue-50 text-blue-800",
                    item.link && "hover:opacity-80 cursor-pointer"
                  )}
                >
                  {item.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  ) : (
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                  )}
                  <span className="flex-1">{item.label}</span>
                  <span className="font-semibold tabular-nums">{item.count}</span>
                  {item.link && <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 opacity-60" />}
                </div>
              );

              return (
                <li key={i}>
                  {item.link ? (
                    <Link to={item.link}>{content}</Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
