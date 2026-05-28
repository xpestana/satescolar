import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { AttendanceBySectionPoint } from "@/hooks/useSchoolAttendance";

interface Props {
  data: AttendanceBySectionPoint[] | undefined;
  isLoading: boolean;
}

function rateColor(rate: number) {
  if (rate >= 85) return "hsl(142, 76%, 36%)";
  if (rate >= 70) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

export function AttendanceBySectionChart({ data, isLoading }: Props) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Tasa de asistencia por sección
        </CardTitle>
        <p className="text-xs text-muted-foreground">Verde ≥85 % · Amarillo ≥70 % · Rojo &lt;70 %</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 8, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
              />
              <YAxis
                type="category"
                dataKey="section"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(214, 32%, 91%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [`${value}%`, "Tasa de asistencia"]}
              />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={28}>
                <LabelList
                  dataKey="rate"
                  position="right"
                  formatter={(v: number) => `${v}%`}
                  style={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                />
                {(data ?? []).map((entry, index) => (
                  <Cell key={index} fill={rateColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
