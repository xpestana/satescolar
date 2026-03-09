import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  schoolId: string | null;
}

export function GrowthByYearChart({ schoolId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["chart-growth-year", schoolId],
    queryFn: async () => {
      const { data: years } = await supabase
        .from("school_years")
        .select("id, year_range, is_active")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: true });

      if (!years || years.length === 0) return [];

      const results = await Promise.all(
        years.map(async (year) => {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId!)
            .eq("school_year_id", year.id);
          return {
            name: year.year_range,
            inscritos: count ?? 0,
            isActive: year.is_active,
          };
        })
      );

      return results;
    },
    enabled: !!schoolId,
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Crecimiento de Inscripciones por Año Escolar
        </CardTitle>
        <p className="text-xs text-muted-foreground">Histórico de alumnos inscritos</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No hay años escolares registrados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradientInscritos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(207, 90%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(207, 90%, 45%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
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
              <Area
                type="monotone"
                dataKey="inscritos"
                stroke="hsl(207, 90%, 45%)"
                strokeWidth={2.5}
                fill="url(#gradientInscritos)"
                dot={{ r: 4, fill: "hsl(207, 90%, 45%)", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
