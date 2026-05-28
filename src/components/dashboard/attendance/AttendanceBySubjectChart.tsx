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
  Legend,
} from "recharts";
import type { AttendanceBySubjectPoint } from "@/hooks/useSchoolAttendance";

interface Props {
  data: AttendanceBySubjectPoint[] | undefined;
  isLoading: boolean;
}

export function AttendanceBySubjectChart({ data, isLoading }: Props) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Asistencia por área
        </CardTitle>
        <p className="text-xs text-muted-foreground">Registros presentes vs ausentes por materia</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis
                dataKey="subject"
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
                formatter={(value: number, name: string) => [
                  value,
                  name === "present" ? "Presentes" : "Ausentes",
                ]}
              />
              <Legend
                formatter={(value) => (value === "present" ? "Presentes" : "Ausentes")}
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Bar
                dataKey="present"
                fill="hsl(142, 76%, 36%)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="absent"
                fill="hsl(0, 84%, 60%)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
