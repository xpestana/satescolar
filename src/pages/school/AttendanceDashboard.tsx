import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AttendanceTrendChart } from "@/components/dashboard/attendance/AttendanceTrendChart";
import { AttendanceBySectionChart } from "@/components/dashboard/attendance/AttendanceBySectionChart";
import { AttendanceBySubjectChart } from "@/components/dashboard/attendance/AttendanceBySubjectChart";
import { TopAbsenteesTable } from "@/components/dashboard/attendance/TopAbsenteesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserCheck, UserX, TrendingUp, CalendarDays } from "lucide-react";
import { useSchoolId } from "@/hooks/useSchoolId";
import {
  useSchoolAttendanceSummary,
  useAttendanceTrend,
  useAttendanceBySection,
  useAttendanceBySubject,
  useTopAbsentees,
  getDateRange,
  type AttendancePeriod,
} from "@/hooks/useSchoolAttendance";

const PERIOD_LABELS: Record<AttendancePeriod, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  custom: "Personalizado",
};

export default function AttendanceDashboard() {
  const { schoolId } = useSchoolId();

  const [period, setPeriod] = useState<AttendancePeriod>("week");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const { dateFrom, dateTo } = getDateRange(
    period,
    customFrom || undefined,
    customTo || undefined
  );

  const { data: summary, isLoading: loadingSummary } = useSchoolAttendanceSummary(
    schoolId ?? undefined,
    dateFrom,
    dateTo
  );
  const { data: trend, isLoading: loadingTrend } = useAttendanceTrend(
    schoolId ?? undefined,
    dateFrom,
    dateTo
  );
  const { data: bySection, isLoading: loadingSection } = useAttendanceBySection(
    schoolId ?? undefined,
    dateFrom,
    dateTo
  );
  const { data: bySubject, isLoading: loadingSubject } = useAttendanceBySubject(
    schoolId ?? undefined,
    dateFrom,
    dateTo
  );
  const { data: topAbsentees, isLoading: loadingAbsentees } = useTopAbsentees(
    schoolId ?? undefined,
    dateFrom,
    dateTo
  );

  const metricValue = (v: number | undefined, loading: boolean, suffix = "") =>
    loading ? "..." : v !== undefined ? `${v}${suffix}` : "0";

  return (
    <DashboardLayout>
      <PageHeader
        title="Dashboard de Asistencia"
        breadcrumbs={[
          { label: "Utilidades" },
          { label: "Dashboard de Asistencia" },
        ]}
        description="Monitorea la asistencia institucional con métricas y gráficos actualizados para tomar decisiones informadas."
      />

      {/* Period filter */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        {(["today", "week", "month", "custom"] as AttendancePeriod[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            className="gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {PERIOD_LABELS[p]}
          </Button>
        ))}

        {period === "custom" && (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-sm w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-sm w-36"
              />
            </div>
          </div>
        )}

        <span className="text-xs text-muted-foreground ml-1">
          {dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total registros"
          value={metricValue(summary?.totalRecords, loadingSummary)}
          icon={<Users className="h-6 w-6" />}
          variant="blue"
        />
        <MetricCard
          title="Presentes"
          value={metricValue(summary?.totalPresent, loadingSummary)}
          icon={<UserCheck className="h-6 w-6" />}
          variant="green"
        />
        <MetricCard
          title="Inasistencias"
          value={metricValue(summary?.totalAbsent, loadingSummary)}
          icon={<UserX className="h-6 w-6" />}
          variant="orange"
        />
        <MetricCard
          title="Tasa de asistencia"
          value={metricValue(summary?.attendanceRate, loadingSummary, "%")}
          icon={<TrendingUp className="h-6 w-6" />}
          variant="purple"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <AttendanceTrendChart data={trend} isLoading={loadingTrend} />
        <AttendanceBySectionChart data={bySection} isLoading={loadingSection} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttendanceBySubjectChart data={bySubject} isLoading={loadingSubject} />
        <TopAbsenteesTable data={topAbsentees} isLoading={loadingAbsentees} />
      </div>
    </DashboardLayout>
  );
}
