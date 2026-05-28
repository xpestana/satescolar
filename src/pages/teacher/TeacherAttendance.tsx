import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeacherData } from "@/hooks/useTeacherData";
import { supabase } from "@/integrations/supabase/client";
import {
  useTeacherAssignments,
  useAttendanceSummary,
  EnrolledStudent,
  TeacherAssignment,
} from "@/hooks/useTeacherAttendance";
import { RegisterTab } from "@/components/teacher/attendance/RegisterTab";
import { HistoryTab } from "@/components/teacher/attendance/HistoryTab";
import { SummaryTab } from "@/components/teacher/attendance/SummaryTab";
import { ClipboardList, History, BarChart2 } from "lucide-react";

// ─── Helper: resolve full name from form_data ────────────────────────────────

function extractFullName(formData: Record<string, unknown>): string {
  return (
    [
      formData?.primer_nombre,
      formData?.segundo_nombre,
      formData?.primer_apellido,
      formData?.segundo_apellido,
    ]
      .filter(Boolean)
      .join(" ") || "Sin nombre"
  );
}

// ─── SectionStudentsProvider ─────────────────────────────────────────────────
// Fetches enrolled students for all teacher sections via parallel queries.

interface SectionStudentsProviderProps {
  assignments: TeacherAssignment[];
  schoolId: string;
  render: (allStudentsBySection: Map<string, EnrolledStudent[]>) => React.ReactNode;
}

function SectionStudentsProvider({
  assignments,
  schoolId,
  render,
}: SectionStudentsProviderProps) {
  const uniqueSections = useMemo(
    () =>
      Array.from(
        new Map(
          assignments
            .filter((a) => a.section?.id && a.school_year?.id)
            .map((a) => [
              a.section!.id,
              { sectionId: a.section!.id, schoolYearId: a.school_year!.id },
            ])
        ).values()
      ),
    [assignments]
  );

  const results = useQueries({
    queries: uniqueSections.map(({ sectionId, schoolYearId }) => ({
      queryKey: ["enrolled-students-section-map", sectionId, schoolYearId],
      queryFn: async () => {
        const { data } = await supabase
          .from("enrollments")
          .select("student_id, student:student_id(id, document_id, form_data, photo_url)")
          .eq("section_id", sectionId)
          .eq("school_year_id", schoolYearId)
          .eq("school_id", schoolId);
        return {
          sectionId,
          students: (
            (data ?? []) as Array<{
              student_id: string;
              student: {
                id: string;
                document_id: string | null;
                form_data: Record<string, unknown>;
                photo_url: string | null;
              } | null;
            }>
          )
            .filter((e) => e.student)
            .map(
              (e) =>
                ({
                  studentId: e.student!.id,
                  documentId: e.student!.document_id,
                  photoUrl: e.student!.photo_url,
                  fullName: extractFullName(e.student!.form_data ?? {}),
                  formData: e.student!.form_data ?? {},
                } as EnrolledStudent)
            ),
        };
      },
      enabled: !!sectionId && !!schoolYearId && !!schoolId,
    })),
  });

  const allStudentsBySection = useMemo(() => {
    const map = new Map<string, EnrolledStudent[]>();
    for (const result of results) {
      if (result.data) map.set(result.data.sectionId, result.data.students);
    }
    return map;
  }, [results]);

  return <>{render(allStudentsBySection)}</>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherAttendance() {
  const { teacher, schoolId } = useTeacherData();
  const [tab, setTab] = useState("register");

  const { data: assignments = [] } = useTeacherAssignments(teacher?.id);

  const sectionIds = useMemo(
    () =>
      assignments
        .map((a) => a.section?.id)
        .filter((id): id is string => !!id),
    [assignments]
  );

  const { data: summaryData, isLoading: summaryLoading } = useAttendanceSummary(
    schoolId ?? undefined,
    sectionIds
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Asistencia de Clases"
        breadcrumbs={[
          { label: "Inicio", href: "/teacher/dashboard" },
          { label: "Asistencia de Clases" },
        ]}
      />

      <div className="p-4 sm:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="register" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="h-3.5 w-3.5" />
              Registrar
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
              <BarChart2 className="h-3.5 w-3.5" />
              Resumen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            {schoolId && <RegisterTab assignments={assignments} schoolId={schoolId} />}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {schoolId && (
              <SectionStudentsProvider
                assignments={assignments}
                schoolId={schoolId}
                render={(allStudentsBySection) => (
                  <HistoryTab
                    assignments={assignments}
                    schoolId={schoolId}
                    allStudentsBySection={allStudentsBySection}
                  />
                )}
              />
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            {schoolId && (
              <SectionStudentsProvider
                assignments={assignments}
                schoolId={schoolId}
                render={(allStudentsBySection) => {
                  const studentNameLookup = new Map<string, string>();
                  for (const students of allStudentsBySection.values()) {
                    for (const s of students) studentNameLookup.set(s.studentId, s.fullName);
                  }
                  return (
                    <SummaryTab
                      summary={summaryData}
                      isLoading={summaryLoading}
                      schoolId={schoolId}
                      sectionIds={sectionIds}
                      studentNameLookup={studentNameLookup}
                    />
                  );
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
