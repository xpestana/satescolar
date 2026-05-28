import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, CheckCircle2, Loader2 } from "lucide-react";
import { StudentAttendanceCard } from "./StudentAttendanceCard";
import { AbsenceConfirmDialog } from "./AbsenceConfirmDialog";
import {
  TeacherAssignment,
  useEnrolledStudents,
  useAttendanceByDate,
  useSaveAttendanceBatch,
  EnrolledStudent,
  AttendanceBatchItem,
} from "@/hooks/useTeacherAttendance";

interface RegisterTabProps {
  assignments: TeacherAssignment[];
  schoolId: string;
}

type StatusMap = Record<string, "present" | "absent">;

const TODAY = new Date();

export function RegisterTab({ assignments, schoolId }: RegisterTabProps) {
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [momento, setMomento] = useState<string>("");
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [pendingAbsent, setPendingAbsent] = useState<EnrolledStudent | null>(null);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === assignmentId) ?? null,
    [assignments, assignmentId]
  );

  const schoolYearId = selectedAssignment?.school_year?.id;
  const sectionId = selectedAssignment?.section?.id;
  const subjectId = selectedAssignment?.subject?.id;

  const { data: students = [], isLoading: loadingStudents } = useEnrolledStudents(
    sectionId,
    schoolYearId,
    schoolId
  );

  // Fetch today's already-saved records for this section
  const { data: todayRecords = [], isLoading: loadingToday } = useAttendanceByDate(
    schoolId,
    sectionId ? [sectionId] : [],
    assignmentId && momento ? TODAY : undefined
  );

  // When assignment/momento changes OR today's records load, populate statusMap
  const prevKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${assignmentId}-${momento}`;
    const keyChanged = key !== prevKeyRef.current;

    if (keyChanged) {
      prevKeyRef.current = key;
      setStatusMap({}); // reset before populating
    }

    if (!assignmentId || !momento || !subjectId) return;

    const momentoNum = Number(momento);
    const matching = todayRecords.filter(
      (r) => r.subject_id === subjectId && r.momento === momentoNum
    );

    if (matching.length > 0) {
      const map: StatusMap = {};
      matching.forEach((r) => {
        map[r.entity_id] = r.status as "present" | "absent";
      });
      setStatusMap(map);
    }
  }, [todayRecords, assignmentId, momento, subjectId]);

  const saveBatch = useSaveAttendanceBatch();

  const markedCount = Object.keys(statusMap).length;
  const allMarked = students.length > 0 && markedCount === students.length;

  // Unmarked students first, marked at the bottom
  const sortedStudents = useMemo(() => {
    const unmarked = students.filter((s) => !(s.studentId in statusMap));
    const marked = students.filter((s) => s.studentId in statusMap);
    return [...unmarked, ...marked];
  }, [students, statusMap]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function buildRecord(
    student: EnrolledStudent,
    status: "present" | "absent"
  ): AttendanceBatchItem {
    const now = new Date();
    return {
      entity_id: student.studentId,
      entity_type: "student",
      school_id: schoolId,
      section_id: selectedAssignment!.section!.id,
      subject_id: selectedAssignment!.subject!.id,
      momento: Number(momento),
      status,
      attendance_date: format(now, "yyyy-MM-dd"),
      attendance_time: format(now, "HH:mm:ss"),
      attendance_timestamp: now.toISOString(),
      record_type: "manual",
      notification_sent: false,
    };
  }

  // ─── Handlers — auto-save on every mark ───────────────────────────────────

  async function handleMarkPresent(student: EnrolledStudent) {
    if (!selectedAssignment || !momento) return;
    setStatusMap((prev) => ({ ...prev, [student.studentId]: "present" }));
    try {
      await saveBatch.mutateAsync([buildRecord(student, "present")]);
    } catch {
      setStatusMap((prev) => {
        const next = { ...prev };
        delete next[student.studentId];
        return next;
      });
      toast.error("Error al guardar la asistencia");
    }
  }

  function handleMarkAbsent(student: EnrolledStudent) {
    if (!selectedAssignment || !momento) return;
    setPendingAbsent(student);
  }

  async function confirmAbsent() {
    if (!pendingAbsent || !selectedAssignment || !momento) return;
    const student = pendingAbsent;
    setPendingAbsent(null);
    setStatusMap((prev) => ({ ...prev, [student.studentId]: "absent" }));
    try {
      await saveBatch.mutateAsync([buildRecord(student, "absent")]);
    } catch {
      setStatusMap((prev) => {
        const next = { ...prev };
        delete next[student.studentId];
        return next;
      });
      toast.error("Error al guardar la asistencia");
    }
  }

  async function handleAllPresent() {
    if (!selectedAssignment || !momento) return;
    const all: StatusMap = {};
    students.forEach((s) => (all[s.studentId] = "present"));
    setStatusMap(all);
    try {
      await saveBatch.mutateAsync(students.map((s) => buildRecord(s, "present")));
    } catch {
      setStatusMap({});
      toast.error("Error al guardar la asistencia");
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const todayLabel = format(TODAY, "EEEE d 'de' MMMM yyyy", { locale: es });
  const isLoading = loadingStudents || loadingToday;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Registrar asistencia — {todayLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="assignment-select">Materia</Label>
              <Select value={assignmentId} onValueChange={setAssignmentId}>
                <SelectTrigger id="assignment-select">
                  <SelectValue placeholder="Selecciona una materia" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.subject?.name ?? "Sin nombre"} — {a.section?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="momento-select">Momento</Label>
              <Select value={momento} onValueChange={setMomento}>
                <SelectTrigger id="momento-select">
                  <SelectValue placeholder="Selecciona el momento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Momento 1</SelectItem>
                  <SelectItem value="2">Momento 2</SelectItem>
                  <SelectItem value="3">Momento 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedAssignment && (
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                Sección: {selectedAssignment.section?.name}
              </Badge>
              <Badge variant="outline">
                {selectedAssignment.school_year?.year_range}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {assignmentId && momento && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              {saveBatch.isPending || isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : allMarked ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={allMarked ? "text-green-600 font-medium" : "text-muted-foreground"}>
                {markedCount} / {students.length} marcados
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAllPresent}
              disabled={saveBatch.isPending || isLoading || allMarked}
            >
              Todos presentes
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay estudiantes matriculados en esta sección.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedStudents.map((student) => (
                <StudentAttendanceCard
                  key={student.studentId}
                  student={student}
                  status={statusMap[student.studentId] ?? null}
                  onMarkPresent={() => handleMarkPresent(student)}
                  onMarkAbsent={() => handleMarkAbsent(student)}
                  disabled={saveBatch.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AbsenceConfirmDialog
        studentName={pendingAbsent?.fullName ?? ""}
        open={!!pendingAbsent}
        onConfirm={confirmAbsent}
        onCancel={() => setPendingAbsent(null)}
      />
    </div>
  );
}
