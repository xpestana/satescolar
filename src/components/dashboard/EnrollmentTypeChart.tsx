import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "hsl(207, 90%, 45%)",
  "hsl(150, 60%, 40%)",
  "hsl(30, 100%, 55%)",
  "hsl(270, 60%, 60%)",
];

interface Props {
  schoolId: string | null;
  activeSchoolYearId: string | null;
}

export function EnrollmentTypeChart({ schoolId, activeSchoolYearId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["chart-enrollment-type", schoolId, activeSchoolYearId],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("enrollment_type")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeSchoolYearId!);

      if (!enrollments || enrollments.length === 0) return [];

      const counts: Record<string, number> = {};
      for (const e of enrollments) {
        const type = e.enrollment_type || "Sin especificar";
        counts[type] = (counts[type] || 0) + 1;
      }

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    enabled: !!schoolId && !!activeSchoolYearId,
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Tipo de Inscripción
        </CardTitle>
        <p className="text-xs text-muted-foreground">Distribución en el año activo</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No hay datos disponibles
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={{ strokeWidth: 1 }}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(214, 32%, 91%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [value, "Inscritos"]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
