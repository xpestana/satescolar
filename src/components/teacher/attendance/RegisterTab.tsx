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
import { Save, Users, CheckCircle2 } from "lucide-react";
import { StudentAttendanceCard } from "./StudentAttendanceCard";
import { AbsenceConfirmDialog } from "./AbsenceConfirmDialog";
import {
  TeacherAssignment,
  useEnrolledStudents,
  useSaveAttendanceBatch,
  EnrolledStudent,
} from "@/hooks/useTeacherAttendance";

interface RegisterTabProps {
  assignments: TeacherAssignment[];
  schoolId: string;
}

type StatusMap = Record<string, "present" | "absent">;

export function RegisterTab({ assignments, schoolId }: RegisterTabProps) {
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [momento, setMomento] = useState<string>("");
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [pendingAbsent, setPendingAbsent] = useState<EnrolledStudent | null>(null);
  const [savedRecently, setSavedRecently] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === assignmentId) ?? null,
    [assignments, assignmentId]
  );

  // Reset marks when the teacher switches to a different assignment
  const prevAssignmentIdRef = useRef<string>("");
  useEffect(() => {
    if (assignmentId !== prevAssignmentIdRef.current) {
      setStatusMap({});
      setSavedRecently(false);
      prevAssignmentIdRef.current = assignmentId;
    }
  }, [assignmentId]);

  const schoolYearId = selectedAssignment?.school_year?.id;
  const sectionId = selectedAssignment?.section?.id;

  const { data: students = [], isLoading: loadingStudents } = useEnrolledStudents(
    sectionId,
    schoolYearId,
    schoolId
  );

  const saveBatch = useSaveAttendanceBatch();

  const markedCount = Object.keys(statusMap).length;
  const allMarked = students.length > 0 && markedCount === students.length;
  const canSave = !!assignmentId && !!momento && allMarked && !saveBatch.isPending;

  // Sort: unmarked students first, marked students at the bottom
  const sortedStudents = useMemo(() => {
    const unmarked = students.filter((s) => !(s.studentId in statusMap));
    const marked = students.filter((s) => s.studentId in statusMap);
    return [...unmarked, ...marked];
  }, [students, statusMap]);

  function handleMarkPresent(student: EnrolledStudent) {
    setStatusMap((prev) => ({ ...prev, [student.studentId]: "present" }));
  }

  function handleMarkAbsent(student: EnrolledStudent) {
    setPendingAbsent(student);
  }

  function confirmAbsent() {
    if (!pendingAbsent) return;
    setStatusMap((prev) => ({ ...prev, [pendingAbsent.studentId]: "absent" }));
    setPendingAbsent(null);
  }

  async function handleSave() {
    if (!selectedAssignment || !momento) return;
    const today = new Date();
    const dateStr = format(today, "yyyy-MM-dd");
    const timeStr = format(today, "HH:mm:ss");
    const ts = today.toISOString();

    const records = students.map((s) => ({
      entity_id: s.studentId,
      entity_type: "student" as const,
      school_id: schoolId,
      section_id: selectedAssignment.section!.id,
      subject_id: selectedAssignment.subject!.id,
      momento: Number(momento),
      status: statusMap[s.studentId] ?? "present",
      attendance_date: dateStr,
      attendance_time: timeStr,
      attendance_timestamp: ts,
      record_type: "manual" as const,
      notification_sent: false,
    }));

    try {
      await saveBatch.mutateAsync(records);
      toast.success("Asistencia guardada correctamente");
      // Show "Guardado" state on button for 2 seconds — do NOT reset marks
      setSavedRecently(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedRecently(false), 2500);
    } catch {
      toast.error("Error al guardar la asistencia");
    }
  }

  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Registrar asistencia — {today}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="assignment-select">Materia</Label>
              <Select
                value={assignmentId}
                onValueChange={(v) => setAssignmentId(v)}
              >
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {markedCount} / {students.length} marcados
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const all: StatusMap = {};
                  students.forEach((s) => (all[s.studentId] = "present"));
                  setStatusMap(all);
                }}
                disabled={saveBatch.isPending}
              >
                Todos presentes
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!canSave}
                className={savedRecently ? "bg-green-600 hover:bg-green-700 gap-1.5" : "gap-1.5"}
              >
                {savedRecently ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Guardado
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>

          {loadingStudents ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay estudiantes matriculados en esta sección.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
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
