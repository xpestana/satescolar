import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "hsl(207, 90%, 45%)",
  "hsl(180, 60%, 45%)",
  "hsl(150, 60%, 40%)",
  "hsl(30, 100%, 55%)",
  "hsl(270, 60%, 60%)",
  "hsl(340, 80%, 55%)",
  "hsl(207, 70%, 55%)",
  "hsl(160, 50%, 45%)",
];

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal",
  maternal: "Maternal",
  inicial: "Inicial",
  primaria: "Primaria",
  media_general: "Media General",
  media_tecnica: "Media Técnica",
  i_nivel: "I Nivel",
  ii_nivel: "II Nivel",
  iii_nivel: "III Nivel",
  "1_grado": "1° Grado",
  "2_grado": "2° Grado",
  "3_grado": "3° Grado",
  "4_grado": "4° Grado",
  "5_grado": "5° Grado",
  "6_grado": "6° Grado",
  "1_ano": "1° Año",
  "2_ano": "2° Año",
  "3_ano": "3° Año",
  "4_ano": "4° Año",
  "5_ano": "5° Año",
  "6_ano": "6° Año",
};

interface Props {
  schoolId: string | null;
  activeSchoolYearId: string | null;
}

export function EnrollmentBySectionChart({ schoolId, activeSchoolYearId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["chart-enrollment-sections", schoolId, activeSchoolYearId],
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
        .select("id, name, grade_level")
        .in("id", sectionIds);

      const sectionMap = new Map(
        (sections || []).map((s) => [s.id, s])
      );

      const counts: Record<string, { name: string; count: number }> = {};
      for (const e of enrollments) {
        const section = sectionMap.get(e.section_id);
        if (!section) continue;
        const gradeLabel = GRADE_LABELS[section.grade_level] || section.grade_level;
        const label = `${gradeLabel} - ${section.name}`;
        if (!counts[label]) counts[label] = { name: label, count: 0 };
        counts[label].count++;
      }

      return Object.values(counts).sort((a, b) => b.count - a.count);
    },
    enabled: !!schoolId && !!activeSchoolYearId,
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Alumnos Inscritos por Sección
        </CardTitle>
        <p className="text-xs text-muted-foreground">Año escolar activo</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No hay inscripciones en el año activo
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(214, 32%, 91%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [value, "Inscritos"]}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
