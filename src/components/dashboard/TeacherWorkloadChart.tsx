import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  schoolId: string | null;
  activeSchoolYearId: string | null;
}

export function TeacherWorkloadChart({ schoolId, activeSchoolYearId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["chart-teacher-workload", schoolId, activeSchoolYearId],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("subject_teacher_assignments")
        .select("teacher_id")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeSchoolYearId!)
        .eq("is_suspended", false);

      if (!assignments || assignments.length === 0) return [];

      const teacherIds = [...new Set(assignments.map((a) => a.teacher_id))];

      const { data: teachers } = await supabase
        .from("teachers")
        .select("id, form_data")
        .in("id", teacherIds)
        .eq("is_suspended", false);

      const teacherMap = new Map(
        (teachers || []).map((t) => {
          const fd = t.form_data as Record<string, string> | null;
          const name = fd
            ? `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim()
            : "Sin nombre";
          return [t.id, name];
        })
      );

      const counts: Record<string, { name: string; asignaciones: number }> = {};
      for (const a of assignments) {
        const name = teacherMap.get(a.teacher_id) || "Sin nombre";
        if (!counts[a.teacher_id]) counts[a.teacher_id] = { name, asignaciones: 0 };
        counts[a.teacher_id].asignaciones++;
      }

      return Object.values(counts).sort((a, b) => b.asignaciones - a.asignaciones);
    },
    enabled: !!schoolId && !!activeSchoolYearId,
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Carga de Trabajo por Docente
        </CardTitle>
        <p className="text-xs text-muted-foreground">Áreas asignadas en el año activo</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No hay asignaciones registradas
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(214, 32%, 91%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [value, "Asignaciones"]}
              />
              <Bar
                dataKey="asignaciones"
                fill="hsl(180, 60%, 45%)"
                radius={[0, 6, 6, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
