import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Info } from "lucide-react";
import DiagnosisStudentList from "@/components/diagnosis/DiagnosisStudentList";
import TeacherSignatureCard from "@/components/grades/TeacherSignatureCard";
import { useGradeStudents } from "@/hooks/useGradeStudents";
import { formatSectionLabel } from "@/lib/gradeLevels";
import { diagnosisSectionKey, isDiagnosisGrade } from "@/lib/diagnosisEligibility";
import { useSectionDiagnosisAssignments } from "@/hooks/useSectionDiagnosisAssignments";

interface AssignmentDetail {
  id: string;
  school_id: string;
  teacher_id: string;
  subject: { name: string } | null;
  school_year: { id: string; year_range: string } | null;
  section: { id: string; name: string; grade_level: string } | null;
}

/** The teacher writes the diagnosis of each student of one of their áreas. */
export default function TeacherDiagnosis() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment-diagnosis", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id, school_id, teacher_id,
          subject:subject_id(name),
          school_year:school_year_id(id, year_range),
          section:section_id(id, name, grade_level)
        `)
        .eq("id", assignmentId!)
        .single();
      if (error) throw error;
      return data as unknown as AssignmentDetail;
    },
    enabled: !!assignmentId,
  });

  const section = assignment?.section && isDiagnosisGrade(assignment.section.grade_level) ? assignment.section : null;
  const { data: diagnosisAssignments, isLoading: diagnosisLoading } = useSectionDiagnosisAssignments(
    assignment?.school_id,
    section ? [section.id] : [],
  );
  const hasDiagnosis =
    !!section &&
    diagnosisAssignments?.get(diagnosisSectionKey(section.id, assignment!.school_year?.id ?? ""))?.assignmentId === assignmentId;
  const { data: students = [], isLoading: studentsLoading } = useGradeStudents({
    assignmentIds: assignmentId ? [assignmentId] : [],
    isGcrp: false,
    sectionId: hasDiagnosis ? assignment?.section?.id : undefined,
    schoolYearId: assignment?.school_year?.id,
    schoolId: assignment?.school_id,
  });

  const sectionLabel = formatSectionLabel(assignment?.section);

  return (
    <DashboardLayout>
      <PageHeader
        title="Diagnóstico"
        breadcrumbs={[
          { label: "Inicio", href: "/teacher/dashboard" },
          { label: "Mis Áreas", href: "/teacher/materias" },
          { label: "Diagnóstico" },
        ]}
      />

      <div className="mb-4 flex items-start gap-3">
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate("/teacher/materias")}>
          <ArrowLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        {isLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : assignment && (
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{assignment.subject?.name}</h2>
            <p className="text-sm text-muted-foreground">
              {sectionLabel} — {assignment.school_year?.year_range}
            </p>
          </div>
        )}
      </div>

      {assignment && !diagnosisLoading && !hasDiagnosis && (
        <div className="rounded-md border bg-muted/20 px-4 py-12 text-center text-muted-foreground">
          El diagnóstico es solo para preescolar y primaria, y lo redacta el docente guía de la sección.
        </div>
      )}

      {hasDiagnosis && (
        <div className="mb-4 flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Redacta una ficha por estudiante con sus fortalezas, debilidades y aspectos a superar.
            Se guarda una vez por año escolar y la puedes corregir cuando quieras.
          </p>
        </div>
      )}

      {assignment && hasDiagnosis && (
        <div className="space-y-4">
          <TeacherSignatureCard
            teacherId={assignment.teacher_id}
            schoolId={assignment.school_id}
            title="Tu firma en la boleta y el diagnóstico"
          />
          <DiagnosisStudentList
            assignmentId={assignment.id}
            schoolId={assignment.school_id}
            students={students}
            studentsLoading={studentsLoading}
            canEdit
            fileLabel={sectionLabel}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
