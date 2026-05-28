import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TeacherAssignment,
  useAttendanceByDate,
  useAttendanceDaysWithRecords,
  useUpdateAttendanceRecord,
  useBulkUpdateMomento,
  EnrolledStudent,
} from "@/hooks/useTeacherAttendance";

interface HistoryTabProps {
  assignments: TeacherAssignment[];
  schoolId: string;
  allStudentsBySection: Map<string, EnrolledStudent[]>;
}

export function HistoryTab({ assignments, schoolId, allStudentsBySection }: HistoryTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [filterAssignmentId, setFilterAssignmentId] = useState<string>("all");
  const [month, setMonth] = useState(new Date());
  const [bulkMomentoOpen, setBulkMomentoOpen] = useState(false);
  const [bulkMomento, setBulkMomento] = useState<string>("");

  const sectionIds = useMemo(
    () =>
      assignments
        .map((a) => a.section?.id)
        .filter((id): id is string => !!id),
    [assignments]
  );

  const filterAssignment = filterAssignmentId !== "all"
    ? assignments.find((a) => a.id === filterAssignmentId) ?? null
    : null;

  const activeSectionIds = filterAssignment
    ? ([filterAssignment.section?.id].filter(Boolean) as string[])
    : sectionIds;

  const { data: daysWithRecords = [] } = useAttendanceDaysWithRecords(
    schoolId,
    activeSectionIds,
    month
  );

  const { data: dayRecords = [], isLoading: loadingRecords } = useAttendanceByDate(
    schoolId,
    activeSectionIds,
    selectedDate
  );

  const updateRecord = useUpdateAttendanceRecord();
  const bulkUpdate = useBulkUpdateMomento();

  // Build a flat lookup of all students
  const studentLookup = useMemo(() => {
    const map = new Map<string, EnrolledStudent>();
    for (const students of allStudentsBySection.values()) {
      for (const s of students) map.set(s.studentId, s);
    }
    return map;
  }, [allStudentsBySection]);

  // Filter records by selected assignment
  const filteredRecords = useMemo(() => {
    if (!filterAssignment) return dayRecords;
    return dayRecords.filter(
      (r) =>
        r.subject_id === filterAssignment.subject?.id &&
        r.section_id === filterAssignment.section?.id
    );
  }, [dayRecords, filterAssignment]);

  async function handleStatusChange(recordId: string, newStatus: "present" | "absent") {
    try {
      await updateRecord.mutateAsync({ id: recordId, status: newStatus });
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar");
    }
  }

  async function handleBulkMomento() {
    if (!bulkMomento || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const sectionId = filterAssignment?.section?.id ?? activeSectionIds[0];
    const subjectId = filterAssignment?.subject?.id ?? null;

    try {
      await bulkUpdate.mutateAsync({
        sectionId,
        date: dateStr,
        subjectId,
        momento: Number(bulkMomento),
      });
      toast.success("Momento actualizado para todos los registros del día");
      setBulkMomentoOpen(false);
      setBulkMomento("");
    } catch {
      toast.error("Error al actualizar el momento");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Filtrar por materia</Label>
              <Select value={filterAssignmentId} onValueChange={setFilterAssignmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las materias</SelectItem>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.subject?.name} — {a.section?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Selecciona un día</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={month}
              onMonthChange={setMonth}
              locale={es}
              modifiers={{ hasRecords: daysWithRecords }}
              modifiersClassNames={{
                hasRecords: "!bg-primary/20 !text-primary font-semibold rounded-full",
              }}
            />
          </CardContent>
        </Card>

        {/* Day detail */}
        <div className="space-y-3">
          {!selectedDate ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Selecciona un día en el calendario para ver la asistencia
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">
                    {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </CardTitle>
                  {filteredRecords.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setBulkMomentoOpen(true)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Cambiar momento del día
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingRecords ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No hay registros para este día
                    {filterAssignment ? " con el filtro seleccionado" : ""}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredRecords.map((record) => {
                      const student = studentLookup.get(record.entity_id);
                      const subjectName = assignments.find(
                        (a) => a.subject?.id === record.subject_id
                      )?.subject?.name;
                      return (
                        <div
                          key={record.id}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                            record.status === "absent" && "border-red-200 bg-red-50",
                            record.status === "present" && "border-green-200 bg-green-50"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {student?.fullName ?? record.entity_id}
                            </p>
                            <div className="flex gap-1.5 flex-wrap mt-0.5">
                              {subjectName && (
                                <Badge variant="secondary" className="text-[10px] h-4">
                                  {subjectName}
                                </Badge>
                              )}
                              {record.momento && (
                                <Badge variant="outline" className="text-[10px] h-4">
                                  M{record.momento}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Select
                            value={record.status}
                            onValueChange={(v) =>
                              handleStatusChange(record.id, v as "present" | "absent")
                            }
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Presente</SelectItem>
                              <SelectItem value="absent">Ausente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bulk moment dialog */}
      <Dialog open={bulkMomentoOpen} onOpenChange={setBulkMomentoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar momento del día</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esto cambiará el momento de todos los registros del{" "}
            <strong>
              {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: es }) : ""}
            </strong>
            {filterAssignment ? ` en ${filterAssignment.subject?.name}` : ""}.
          </p>
          <div className="space-y-1.5">
            <Label>Nuevo momento</Label>
            <Select value={bulkMomento} onValueChange={setBulkMomento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el momento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Momento 1</SelectItem>
                <SelectItem value="2">Momento 2</SelectItem>
                <SelectItem value="3">Momento 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMomentoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkMomento} disabled={!bulkMomento || bulkUpdate.isPending}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
