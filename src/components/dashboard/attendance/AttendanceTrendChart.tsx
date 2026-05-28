import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AttendanceTrendPoint } from "@/hooks/useSchoolAttendance";

interface Props {
  data: AttendanceTrendPoint[] | undefined;
  isLoading: boolean;
}

export function AttendanceTrendChart({ data, isLoading }: Props) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Tendencia de asistencia
        </CardTitle>
        <p className="text-xs text-muted-foreground">Presentes vs ausentes por día</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            Sin registros en el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
                angle={-35}
                textAnchor="end"
                interval="preserveStartEnd"
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
                formatter={(value: number, name: string) => [
                  value,
                  name === "present" ? "Presentes" : "Ausentes",
                ]}
              />
              <Legend
                formatter={(value) => (value === "present" ? "Presentes" : "Ausentes")}
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Area
                type="monotone"
                dataKey="present"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fill="url(#gradPresent)"
              />
              <Area
                type="monotone"
                dataKey="absent"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fill="url(#gradAbsent)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
