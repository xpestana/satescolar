import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Info, EyeOff, AlertTriangle } from "lucide-react";
import { useGradeVisibilitySettings, VISIBILITY_MOMENTOS, MOMENTO_LABELS } from "@/hooks/useGradeVisibilitySettings";
import { useStudentGradeBlock } from "@/hooks/useStudentGradeBlock";
import StudentGradeAccessToggle from "@/components/students/StudentGradeAccessToggle";
import { studentListName } from "@/lib/studentName";

/**
 * "Visibilidad para Representantes" tab of /notas/consulta.
 *
 * Two independent switches: what the school publishes for a whole school year (per momento) and
 * which individual students are blocked. Both are enforced in RLS, not only here.
 */

interface EnrollmentRow {
  student_id: string;
  student: { id: string; document_id: string | null; form_data: Record<string, unknown> | null } | null;
}

interface RepresentativeVisibilityTabProps {
  schoolId: string;
  schoolYearId: string;
  yearRange: string;
  isActiveYear: boolean;
  sectionId: string;
  sectionName: string;
}

export default function RepresentativeVisibilityTab({
  schoolId,
  schoolYearId,
  yearRange,
  isActiveYear,
  sectionId,
  sectionName,
}: RepresentativeVisibilityTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { isVisible, setVisibility, isLoading } = useGradeVisibilitySettings(schoolId, schoolYearId);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["visibility-students", sectionId, schoolYearId, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, student:student_id(id, document_id, form_data)")
        .eq("section_id", sectionId)
        .eq("school_year_id", schoolYearId)
        .eq("school_id", schoolId);
      if (error) throw error;
      return ((data ?? []) as unknown as EnrollmentRow[])
        .map((e: EnrollmentRow) => ({
          studentId: e.student_id,
          name: studentListName(e.student?.form_data),
          documentId: e.student?.document_id as string | null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!sectionId && !!schoolYearId && !!schoolId,
  });

  const studentIds = useMemo(() => students.map((s) => s.studentId), [students]);
  const { isBlocked, blockedCount, setBlocked } = useStudentGradeBlock(schoolId, studentIds);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(term) || (s.documentId || "").toLowerCase().includes(term),
    );
  }, [students, searchTerm]);

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Desde aquí decide qué ven los representantes en su sesión. Un momento apagado significa
          que <strong>no verán las notas ni podrán descargar la boleta</strong> de ese momento.
          Los momentos empiezan apagados: se publican solo cuando usted lo indica. Además, los
          representantes con cuotas vencidas quedan bloqueados automáticamente.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Publicación de notas y boletas</CardTitle>
              <CardDescription>Año escolar {yearRange}</CardDescription>
            </div>
            {!isActiveYear && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                No es el año escolar activo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VISIBILITY_MOMENTOS.map((momento) => {
                const visible = isVisible(momento);
                return (
                  <div
                    key={momento}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{MOMENTO_LABELS[momento]}</p>
                      <p className="text-xs text-muted-foreground">
                        {visible ? "Visible para los representantes" : "Oculto para los representantes"}
                      </p>
                    </div>
                    <Switch
                      checked={visible}
                      disabled={setVisibility.isPending}
                      onCheckedChange={(checked) => setVisibility.mutate({ momento, visible: checked })}
                      aria-label={`${MOMENTO_LABELS[momento]} visible para los representantes`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Bloqueo por estudiante</CardTitle>
              <CardDescription>
                Sección {sectionName} · el bloqueo aplica a todos los años escolares y momentos
              </CardDescription>
            </div>
            {blockedCount > 0 && (
              <Badge variant="destructive">
                <EyeOff className="h-3 w-3 mr-1" />
                {blockedCount} bloqueado{blockedCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar estudiante..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {studentsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay estudiantes inscritos en esta sección.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {filteredStudents.map((student) => (
                <div key={student.studentId} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.documentId || "Sin documento"}</p>
                  </div>
                  <StudentGradeAccessToggle
                    variant="switch"
                    studentName={student.name}
                    isBlocked={isBlocked(student.studentId)}
                    disabled={setBlocked.isPending}
                    onToggle={(blocked) => setBlocked.mutate({ studentId: student.studentId, blocked })}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
