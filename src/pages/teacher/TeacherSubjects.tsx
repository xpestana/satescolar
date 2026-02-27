import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal",
  maternal: "Maternal",
  inicial: "Inicial",
  i_nivel: "I Nivel",
  ii_nivel: "II Nivel",
  iii_nivel: "III Nivel",
  primaria: "Primaria",
  "1_grado": "1er Grado",
  "2_grado": "2do Grado",
  "3_grado": "3er Grado",
  "4_grado": "4to Grado",
  "5_grado": "5to Grado",
  "6_grado": "6to Grado",
  media_general: "Media General",
  "1_ano": "1er Año",
  "2_ano": "2do Año",
  "3_ano": "3er Año",
  "4_ano": "4to Año",
  "5_ano": "5to Año",
  media_tecnica: "Media Técnica",
  "6_ano": "6to Año",
};

interface AssignmentWithDetails {
  id: string;
  subject: {
    id: string;
    name: string;
    subject_type: string;
    evaluation_type: string;
  };
  school_year: {
    id: string;
    year_range: string;
    is_active: boolean;
  };
  section: {
    id: string;
    name: string;
    grade_level: string;
  } | null;
}

export default function TeacherSubjects() {
  const { teacher, isLoading: teacherLoading } = useTeacherData();

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["teacher-subjects", teacher?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id,
          subject:subject_id(id, name, subject_type, evaluation_type),
          school_year:school_year_id(id, year_range, is_active),
          section:section_id(id, name, grade_level)
        `)
        .eq("teacher_id", teacher!.id);

      if (error) throw error;
      return (data as unknown as AssignmentWithDetails[]) || [];
    },
    enabled: !!teacher?.id,
  });

  const loading = teacherLoading || assignmentsLoading;

  // Group by school year
  const groupedByYear = assignments.reduce<Record<string, AssignmentWithDetails[]>>((acc, a) => {
    const key = a.school_year?.year_range || "Sin año";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <PageHeader title="Mis Materias" breadcrumbs={[{ label: "Inicio", href: "/teacher/dashboard" }, { label: "Mis Materias" }]} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Sin materias asignadas</h3>
          <p className="text-muted-foreground mt-1">Aún no tienes materias asignadas por el colegio.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByYear).map(([yearRange, yearAssignments]) => {
            const isActive = yearAssignments[0]?.school_year?.is_active;
            return (
              <div key={yearRange}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    Año Escolar: {yearRange}
                  </h3>
                  {isActive && (
                    <Badge variant="default" className="text-xs">Activo</Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearAssignments.map((a) => {
                    const sectionLabel = a.section
                      ? `${GRADE_LABELS[a.section.grade_level] || a.section.grade_level} - Sección ${a.section.name}`
                      : "Sin sección";
                    return (
                      <Card key={a.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{a.subject?.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{sectionLabel}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant={a.subject?.subject_type === "gcrp" ? "secondary" : "outline"} className="text-xs">
                                  {a.subject?.subject_type === "gcrp" ? "GCRP" : "Regular"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {a.subject?.evaluation_type === "literal" ? "Literal" : "Numérica"}
                                </Badge>
                              </div>
                            </div>
                            <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
