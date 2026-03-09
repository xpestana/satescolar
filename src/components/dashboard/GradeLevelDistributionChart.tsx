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
  "hsl(340, 80%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(50, 90%, 50%)",
  "hsl(10, 80%, 55%)",
];

const GRADE_GROUPS: Record<string, string> = {
  pre_maternal: "Preescolar",
  maternal: "Preescolar",
  inicial: "Preescolar",
  i_nivel: "Preescolar",
  ii_nivel: "Preescolar",
  iii_nivel: "Preescolar",
  primaria: "Primaria",
  "1_grado": "Primaria",
  "2_grado": "Primaria",
  "3_grado": "Primaria",
  "4_grado": "Primaria",
  "5_grado": "Primaria",
  "6_grado": "Primaria",
  media_general: "Media",
  media_tecnica: "Media",
  "1_ano": "Media",
  "2_ano": "Media",
  "3_ano": "Media",
  "4_ano": "Media",
  "5_ano": "Media",
  "6_ano": "Media",
};

interface Props {
  schoolId: string | null;
  activeSchoolYearId: string | null;
}

export function GradeLevelDistributionChart({ schoolId, activeSchoolYearId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["chart-grade-distribution", schoolId, activeSchoolYearId],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("section_id")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeSchoolYearId!);

      if (!enrollments || enrollments.length === 0) return [];

      const sectionIds = [...new Set(enrollments.map((e) => e.section_id))];

      const { data: sections } = await supabase
        .from("sections")
        .select("id, grade_level")
        .in("id", sectionIds);

      const sectionMap = new Map((sections || []).map((s) => [s.id, s.grade_level]));

      const counts: Record<string, number> = {};
      for (const e of enrollments) {
        const grade = sectionMap.get(e.section_id);
        if (!grade) continue;
        const group = GRADE_GROUPS[grade] || "Otro";
        counts[group] = (counts[group] || 0) + 1;
      }

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    enabled: !!schoolId && !!activeSchoolYearId,
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Distribución por Nivel Educativo
        </CardTitle>
        <p className="text-xs text-muted-foreground">Inscritos en el año activo</p>
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
                innerRadius={55}
                outerRadius={95}
                paddingAngle={4}
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
                formatter={(value: number) => [value, "Alumnos"]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
