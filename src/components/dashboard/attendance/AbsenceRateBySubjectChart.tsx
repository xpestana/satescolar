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
import type { AttendanceBySubjectPoint } from "@/hooks/useSchoolAttendance";

interface Props {
  data: AttendanceBySubjectPoint[] | undefined;
  isLoading: boolean;
}

function rateColor(rate: number) {
  if (rate >= 30) return "hsl(0, 84%, 60%)";
  if (rate >= 15) return "hsl(38, 92%, 50%)";
  return "hsl(142, 76%, 36%)";
}

export function AbsenceRateBySubjectChart({ data, isLoading }: Props) {
  const chartData = (data ?? [])
    .map((d) => {
      const total = d.present + d.absent;
      return {
        subject: d.subject,
        rate: total > 0 ? Math.round((d.absent / total) * 100) : 0,
        absent: d.absent,
        total,
      };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.rate - a.rate);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Áreas con mayor inasistencia
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tasa de ausencias por área · Rojo ≥30 % · Amarillo ≥15 % · Verde &lt;15 %
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 48, left: 8, bottom: 5 }}
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
                dataKey="subject"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(214, 32%, 91%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number, _: string, props) => [
                  `${value}% (${props.payload.absent}/${props.payload.total} registros)`,
                  "Tasa de inasistencia",
                ]}
              />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={28}>
                <LabelList
                  dataKey="rate"
                  position="right"
                  formatter={(v: number) => `${v}%`}
                  style={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                />
                {chartData.map((entry, index) => (
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
