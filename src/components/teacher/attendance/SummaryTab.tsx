import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Users, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";
import {
  AttendanceSummary,
  useStudentAttendanceHistory,
} from "@/hooks/useTeacherAttendance";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SummaryTabProps {
  summary: AttendanceSummary | undefined;
  isLoading: boolean;
  schoolId: string;
  sectionIds: string[];
  studentNameLookup: Map<string, string>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-lg p-2", color ?? "bg-primary/10")}>
            <Icon className={cn("h-4 w-4", color ? "text-white" : "text-primary")} />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentHistoryDialog({
  open,
  onClose,
  studentId,
  studentName,
  schoolId,
  sectionIds,
  subjectLookup,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  schoolId: string;
  sectionIds: string[];
  subjectLookup: Map<string, string>;
}) {
  const { data: history = [] } = useStudentAttendanceHistory(schoolId, studentId, sectionIds);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{studentName}</DialogTitle>
        </DialogHeader>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin registros de asistencia.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                  r.status === "absent" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
                )}
              >
                <div>
                  <p className="font-medium">
                    {format(new Date(r.attendance_date + "T12:00:00"), "d 'de' MMMM yyyy", {
                      locale: es,
                    })}
                  </p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {r.subject_id && subjectLookup.get(r.subject_id) && (
                      <Badge variant="secondary" className="text-[10px] h-4">
                        {subjectLookup.get(r.subject_id)}
                      </Badge>
                    )}
                    {r.momento && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        M{r.momento}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0",
                    r.status === "absent"
                      ? "border-red-300 text-red-700 bg-red-50"
                      : "border-green-300 text-green-700 bg-green-50"
                  )}
                >
                  {r.status === "absent" ? "Ausente" : "Presente"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SummaryTab({
  summary,
  isLoading,
  schoolId,
  sectionIds,
  studentNameLookup,
}: SummaryTabProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const subjectLookup = new Map<string, string>(); // populated from parent if needed

  const topAbsent = (summary?.absencesByStudent ?? [])
    .sort((a, b) => b.absences - a.absences)
    .slice(0, 10)
    .map((s) => ({
      ...s,
      fullName: studentNameLookup.get(s.studentId) ?? s.studentId.slice(0, 8),
      shortName:
        (studentNameLookup.get(s.studentId) ?? s.studentId).split(" ").slice(0, 2).join(" "),
    }));

  const weeklyData = summary?.absencesByWeek ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!summary || summary.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">Aún no tienes registros de asistencia.</p>
          <p className="text-xs">Ve al tab "Registrar" para comenzar.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedStudent = selectedStudentId
    ? {
        id: selectedStudentId,
        name: studentNameLookup.get(selectedStudentId) ?? selectedStudentId,
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={Users}
          label="Registros totales"
          value={summary.totalSessions}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Inasistencias"
          value={summary.totalAbsences}
          color="bg-red-500"
        />
        <MetricCard
          icon={TrendingUp}
          label="Tasa de asistencia"
          value={`${summary.attendanceRate}%`}
          color="bg-green-600"
        />
      </div>

      {/* Bar chart: absences by student */}
      {topAbsent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inasistencias por estudiante</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, topAbsent.length * 36)}>
              <BarChart
                data={topAbsent}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [value, "Inasistencias"]}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="absences" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Line/bar chart: weekly absences */}
      {weeklyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Asistencia por semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="present" name="Presentes" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absences" name="Ausentes" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ranked absence list */}
      {topAbsent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estudiantes con más inasistencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {topAbsent.map((s, idx) => (
                <Button
                  key={s.studentId}
                  variant="ghost"
                  className="w-full justify-between h-auto py-2 px-3"
                  onClick={() => setSelectedStudentId(s.studentId)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-4 text-right">
                      {idx + 1}.
                    </span>
                    <span className="text-sm font-normal">{s.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs border-red-200 text-red-700 bg-red-50"
                    >
                      {s.absences} ausencia{s.absences !== 1 ? "s" : ""}
                    </Badge>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student detail dialog */}
      {selectedStudent && (
        <StudentHistoryDialog
          open={!!selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          schoolId={schoolId}
          sectionIds={sectionIds}
          subjectLookup={subjectLookup}
        />
      )}
    </div>
  );
}
