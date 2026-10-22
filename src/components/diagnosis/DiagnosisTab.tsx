import { Skeleton } from "@/components/ui/skeleton";
import DiagnosisStudentList from "@/components/diagnosis/DiagnosisStudentList";
import TeacherSignatureCard from "@/components/grades/TeacherSignatureCard";
import { useSectionDiagnosisAssignments } from "@/hooks/useSectionDiagnosisAssignments";
import { useGradeStudents } from "@/hooks/useGradeStudents";
import { diagnosisSectionKey } from "@/lib/diagnosisEligibility";

interface DiagnosisTabProps {
  schoolId: string;
  schoolYearId: string;
  sectionId: string;
  sectionLabel: string;
  canEdit: boolean;
}

/**
 * School view of the diagnoses of a preschool or primary section. Like the boleta download it only
 * needs the section: the diagnoses are the ones of the área that carries them (see diagnosisEligibility).
 */
export default function DiagnosisTab({ schoolId, schoolYearId, sectionId, sectionLabel, canEdit }: DiagnosisTabProps) {
  const { data: picked, isLoading } = useSectionDiagnosisAssignments(schoolId, [sectionId]);
  const area = picked?.get(diagnosisSectionKey(sectionId, schoolYearId)) ?? null;
  const { data: students = [], isLoading: studentsLoading } = useGradeStudents({
    assignmentIds: [],
    isGcrp: false,
    sectionId,
    schoolYearId,
    schoolId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!area) {
    return (
      <div className="rounded-md border bg-muted/20 px-4 py-12 text-center text-muted-foreground">
        La sección {sectionLabel} no tiene áreas asignadas en este año escolar. Asígnalas en
        <span className="font-medium"> Asignación de Áreas</span> para poder redactar diagnósticos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          {sectionLabel} · Docente guía: <span className="font-medium text-foreground">{area.teacherName || "Sin nombre"}</span>
          {area.subjectName && ` (${area.subjectName})`}. Un diagnóstico por estudiante y año escolar.
        </p>
        {!area.isMainReport && (
          <p className="text-xs">
            Ninguna área de la sección está marcada como principal, así que se usa la primera. Puedes
            marcarla en Asignación de Áreas.
          </p>
        )}
      </div>
      <TeacherSignatureCard
        teacherId={area.teacherId}
        schoolId={schoolId}
        canEdit={canEdit}
        title="Firma del docente guía en la boleta y el diagnóstico"
      />
      <DiagnosisStudentList
        assignmentId={area.assignmentId}
        schoolId={schoolId}
        students={students}
        studentsLoading={studentsLoading}
        canEdit={canEdit}
        fileLabel={sectionLabel}
      />
    </div>
  );
}
