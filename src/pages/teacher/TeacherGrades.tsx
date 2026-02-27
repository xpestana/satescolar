import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTeacherData } from "@/hooks/useTeacherData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
  i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
  primaria: "Primaria",
  "1_grado": "1er Grado", "2_grado": "2do Grado", "3_grado": "3er Grado",
  "4_grado": "4to Grado", "5_grado": "5to Grado", "6_grado": "6to Grado",
  media_general: "Media General",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año",
  media_tecnica: "Media Técnica", "6_ano": "6to Año",
};

const NUMERIC_GRADES = new Set([
  "media_general", "1_ano", "2_ano", "3_ano", "4_ano", "5_ano",
  "media_tecnica", "6_ano",
]);

interface PlanItem {
  id: string;
  description: string;
  percentage: number | null;
  display_order: number;
}

interface StudentRow {
  student_id: string;
  student_name: string;
  document_id: string | null;
}

export default function TeacherGrades() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { teacher } = useTeacherData();
  const queryClient = useQueryClient();

  // Local state: { [studentId-planItemId]: gradeValue }
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch assignment details
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ["assignment-detail", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id, school_id,
          subject:subject_id(id, name, subject_type, evaluation_type),
          school_year:school_year_id(id, year_range, is_active),
          section:section_id(id, name, grade_level)
        `)
        .eq("id", assignmentId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!assignmentId,
  });

  const gradeLevel = assignment?.section?.grade_level as string | undefined;
  const isNumeric = gradeLevel ? NUMERIC_GRADES.has(gradeLevel) : false;
  const sectionLabel = assignment?.section
    ? `${GRADE_LABELS[assignment.section.grade_level] || assignment.section.grade_level} - Sección ${assignment.section.name}`
    : "";

  // Fetch evaluation plan items
  const { data: planItems = [], isLoading: planLoading } = useQuery({
    queryKey: ["evaluation-plan", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_plan_items" as any)
        .select("*")
        .eq("assignment_id", assignmentId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as PlanItem[]) || [];
    },
    enabled: !!assignmentId,
  });

  // Fetch enrolled students for the section + school year
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["enrolled-students", assignment?.section?.id, assignment?.school_year?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          student:student_id(id, document_id, form_data)
        `)
        .eq("section_id", assignment!.section!.id)
        .eq("school_year_id", assignment!.school_year!.id)
        .eq("school_id", assignment!.school_id);
      if (error) throw error;

      return (data || []).map((e: any) => {
        const fd = e.student?.form_data as Record<string, any> | null;
        const firstName = fd?.nombre || fd?.primer_nombre || "";
        const lastName = fd?.apellido || fd?.primer_apellido || "";
        const fullName = `${firstName} ${lastName}`.trim() || "Sin nombre";
        return {
          student_id: e.student_id,
          student_name: fullName,
          document_id: e.student?.document_id,
        } as StudentRow;
      }).sort((a: StudentRow, b: StudentRow) => a.student_name.localeCompare(b.student_name));
    },
    enabled: !!assignment?.section?.id && !!assignment?.school_year?.id,
  });

  // Fetch existing grades
  const { data: existingGrades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["student-grades", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_grades" as any)
        .select("*")
        .eq("assignment_id", assignmentId!);
      if (error) throw error;
      return (data as unknown as { id: string; student_id: string; evaluation_plan_item_id: string; grade_value: string | null }[]) || [];
    },
    enabled: !!assignmentId,
  });

  // Populate local state from existing grades
  useEffect(() => {
    const map: Record<string, string> = {};
    existingGrades.forEach((g) => {
      map[`${g.student_id}-${g.evaluation_plan_item_id}`] = g.grade_value || "";
    });
    setGrades(map);
  }, [existingGrades]);

  const gradeKey = (studentId: string, planItemId: string) => `${studentId}-${planItemId}`;

  const handleGradeChange = (studentId: string, planItemId: string, value: string) => {
    if (isNumeric) {
      // Allow empty or numbers 1-20
      if (value !== "" && (isNaN(Number(value)) || Number(value) < 1 || Number(value) > 20)) return;
    }
    setGrades((prev) => ({ ...prev, [gradeKey(studentId, planItemId)]: value }));
  };

  const handleSave = async () => {
    if (!assignmentId || !assignment) return;
    setIsSaving(true);
    try {
      // Build upsert rows for all grades that have values
      const rows: any[] = [];
      students.forEach((s) => {
        planItems.forEach((pi) => {
          const val = grades[gradeKey(s.student_id, pi.id)];
          if (val !== undefined && val !== "") {
            rows.push({
              student_id: s.student_id,
              evaluation_plan_item_id: pi.id,
              assignment_id: assignmentId,
              school_id: assignment.school_id,
              grade_value: val,
              updated_at: new Date().toISOString(),
            });
          }
        });
      });

      if (rows.length > 0) {
        const { error } = await supabase
          .from("student_grades" as any)
          .upsert(rows as any, { onConflict: "student_id,evaluation_plan_item_id" });
        if (error) throw error;
      }

      // Delete grades that were cleared
      const toDelete: { studentId: string; planItemId: string }[] = [];
      existingGrades.forEach((g) => {
        const val = grades[gradeKey(g.student_id, g.evaluation_plan_item_id)];
        if (val === undefined || val === "") {
          toDelete.push({ studentId: g.student_id, planItemId: g.evaluation_plan_item_id });
        }
      });
      for (const d of toDelete) {
        await supabase
          .from("student_grades" as any)
          .delete()
          .eq("student_id", d.studentId)
          .eq("evaluation_plan_item_id", d.planItemId);
      }

      queryClient.invalidateQueries({ queryKey: ["student-grades", assignmentId] });
      toast.success("Notas guardadas correctamente");
    } catch (e: any) {
      toast.error(e.message || "Error al guardar notas");
    } finally {
      setIsSaving(false);
    }
  };

  const loading = assignmentLoading || planLoading || studentsLoading || gradesLoading;

  return (
    <DashboardLayout>
      <PageHeader
        title="Registro de Notas"
        breadcrumbs={[
          { label: "Inicio", href: "/teacher/dashboard" },
          { label: "Mis Materias", href: "/teacher/materias" },
          { label: "Notas" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/teacher/materias")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          {assignment && (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{assignment.subject?.name}</h2>
              <p className="text-sm text-muted-foreground">{sectionLabel} — {assignment.school_year?.year_range}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isNumeric ? "default" : "secondary"}>
            {isNumeric ? "Numérica (1-20)" : "Descriptiva"}
          </Badge>
          <Button onClick={handleSave} disabled={isSaving || loading}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Notas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : planItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay plan de evaluación definido para esta materia.</p>
          <p className="text-sm text-muted-foreground mt-1">Primero debes agregar un plan de evaluación desde "Mis Materias".</p>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay estudiantes inscritos en esta sección y año escolar.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Estudiante</TableHead>
                <TableHead className="sticky left-[200px] bg-background z-10 min-w-[100px]">Cédula</TableHead>
                {planItems.map((pi) => (
                  <TableHead key={pi.id} className="min-w-[150px] text-center">
                    <div>{pi.description}</div>
                    {pi.percentage != null && (
                      <span className="text-xs text-muted-foreground">{pi.percentage}%</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.student_id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.student_name}</TableCell>
                  <TableCell className="sticky left-[200px] bg-background z-10 text-sm text-muted-foreground">{s.document_id || "—"}</TableCell>
                  {planItems.map((pi) => (
                    <TableCell key={pi.id} className="text-center p-1.5">
                      {isNumeric ? (
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={grades[gradeKey(s.student_id, pi.id)] || ""}
                          onChange={(e) => handleGradeChange(s.student_id, pi.id, e.target.value)}
                          className="h-8 w-16 mx-auto text-center text-sm"
                          placeholder="—"
                        />
                      ) : (
                        <Textarea
                          value={grades[gradeKey(s.student_id, pi.id)] || ""}
                          onChange={(e) => handleGradeChange(s.student_id, pi.id, e.target.value)}
                          className="min-h-[60px] text-sm resize-y"
                          placeholder="Escribir nota descriptiva..."
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardLayout>
  );
}
