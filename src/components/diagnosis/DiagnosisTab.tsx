import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";
import DiagnosisStudentList from "@/components/diagnosis/DiagnosisStudentList";
import TeacherSignatureCard from "@/components/grades/TeacherSignatureCard";
import { useSectionDiagnosisAreas } from "@/hooks/useSectionDiagnosisAreas";
import { useDiagnosisCounts } from "@/hooks/useDiagnosisCounts";
import { useGradeStudents } from "@/hooks/useGradeStudents";
import { defaultDiagnosisArea } from "@/lib/diagnosisAreas";

interface DiagnosisTabProps {
  schoolId: string;
  schoolYearId: string;
  sectionId: string;
  sectionLabel: string;
  canEdit: boolean;
}

/**
 * School view of the diagnoses of a section. Like the boleta download it only needs the section:
 * its áreas show up as buttons (main one first and selected), each with how many are written.
 */
export default function DiagnosisTab({ schoolId, schoolYearId, sectionId, sectionLabel, canEdit }: DiagnosisTabProps) {
  const { data: areas = [], isLoading: areasLoading } = useSectionDiagnosisAreas(schoolId, schoolYearId, sectionId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A new section (or year) starts on its main área.
  useEffect(() => {
    setSelectedId(defaultDiagnosisArea(areas)?.assignmentId ?? null);
  }, [areas]);

  const assignmentIds = useMemo(() => areas.map((a) => a.assignmentId), [areas]);
  const { data: counts = {} } = useDiagnosisCounts(assignmentIds);
  const { data: students = [], isLoading: studentsLoading } = useGradeStudents({
    assignmentIds,
    isGcrp: false,
    sectionId,
    schoolYearId,
    schoolId,
  });

  const selected = areas.find((a) => a.assignmentId === selectedId) ?? null;

  if (areasLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 px-4 py-12 text-center text-muted-foreground">
        La sección {sectionLabel} no tiene áreas asignadas en este año escolar. Asígnalas en
        <span className="font-medium"> Asignación de Áreas</span> para poder redactar diagnósticos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Áreas de {sectionLabel}. Cada docente redacta un diagnóstico por estudiante en su área, una vez por año escolar.
        </p>
        {/* Phones: one row that slides sideways. */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
          {areas.map((a) => {
            const active = a.assignmentId === selectedId;
            const done = counts[a.assignmentId] ?? 0;
            return (
              <button
                key={a.assignmentId}
                type="button"
                onClick={() => setSelectedId(a.assignmentId)}
                aria-pressed={active}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {a.isMain && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Área principal" />}
                  {a.subjectName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {a.teacherName || "Sin docente"} · {done}/{students.length || "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div key={selected.assignmentId} className="space-y-4">
          <TeacherSignatureCard
            teacherId={selected.teacherId}
            schoolId={schoolId}
            canEdit={canEdit}
            title={`Firma de ${selected.teacherName || "el docente"} en la boleta y el diagnóstico`}
          />
          <DiagnosisStudentList
            assignmentId={selected.assignmentId}
            schoolId={schoolId}
            students={students}
            studentsLoading={studentsLoading}
            canEdit={canEdit}
            fileLabel={`${selected.subjectName} ${sectionLabel}`}
          />
        </div>
      )}
    </div>
  );
}
