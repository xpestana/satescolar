import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Info, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Props {
  schoolId: string | null;
  activeSchoolYearId: string | null;
}

interface PendingItem {
  label: string;
  count: number;
  type: "warning" | "info";
  link?: string;
}

export function PendingItemsCard({ schoolId, activeSchoolYearId }: Props) {
  const { data: items, isLoading } = useQuery({
    queryKey: ["dashboard-pending", schoolId, activeSchoolYearId],
    queryFn: async () => {
      const pending: PendingItem[] = [];

      // 1. Students in system but NOT enrolled in active year
      if (activeSchoolYearId) {
        const [{ data: allStudentSchools }, { data: enrolledStudents }] = await Promise.all([
          supabase
            .from("student_schools")
            .select("student_id")
            .eq("school_id", schoolId!),
          supabase
            .from("enrollments")
            .select("student_id")
            .eq("school_id", schoolId!)
            .eq("school_year_id", activeSchoolYearId),
        ]);

        const enrolledIds = new Set((enrolledStudents || []).map((e) => e.student_id));
        const notEnrolled = (allStudentSchools || []).filter(
          (s) => !enrolledIds.has(s.student_id)
        ).length;

        if (notEnrolled > 0) {
          pending.push({
            label: "Alumnos registrados sin inscripción en el año activo",
            count: notEnrolled,
            type: "warning",
            link: "/inscripciones",
          });
        }
      }

      // 2. Teachers without assignments in active year
      if (activeSchoolYearId) {
        const [{ data: allTeachers }, { data: assignedTeachers }] = await Promise.all([
          supabase
            .from("teachers")
            .select("id")
            .eq("school_id", schoolId!)
            .eq("is_suspended", false),
          supabase
            .from("subject_teacher_assignments")
            .select("teacher_id")
            .eq("school_id", schoolId!)
            .eq("school_year_id", activeSchoolYearId)
            .eq("is_suspended", false),
        ]);

        const assignedIds = new Set((assignedTeachers || []).map((a) => a.teacher_id));
        const unassigned = (allTeachers || []).filter((t) => !assignedIds.has(t.id)).length;

        if (unassigned > 0) {
          pending.push({
            label: "Docentes activos sin áreas asignadas en el año activo",
            count: unassigned,
            type: "warning",
            link: "/asignacion-materias",
          });
        }
      }

      // 3. Subjects not assigned to any teacher
      if (activeSchoolYearId) {
        const [{ data: allSubjects }, { data: assignedSubjects }] = await Promise.all([
          supabase
            .from("school_subjects")
            .select("id")
            .eq("school_id", schoolId!)
            .eq("is_suspended", false),
          supabase
            .from("subject_teacher_assignments")
            .select("subject_id")
            .eq("school_id", schoolId!)
            .eq("school_year_id", activeSchoolYearId)
            .eq("is_suspended", false),
        ]);

        const assignedSubjectIds = new Set((assignedSubjects || []).map((a) => a.subject_id));
        const unassignedSubjects = (allSubjects || []).filter(
          (s) => !assignedSubjectIds.has(s.id)
        ).length;

        if (unassignedSubjects > 0) {
          pending.push({
            label: "Áreas curriculares sin docente asignado",
            count: unassignedSubjects,
            type: "info",
            link: "/asignacion-materias",
          });
        }
      }

      // 4. No active school year
      if (!activeSchoolYearId) {
        pending.push({
          label: "No hay un año escolar activo configurado",
          count: 1,
          type: "warning",
          link: "/anos-secciones",
        });
      }

      return pending;
    },
    enabled: !!schoolId,
  });

  const hasPending = items && items.length > 0;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          {hasPending ? (
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
