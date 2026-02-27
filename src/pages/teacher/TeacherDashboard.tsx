import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { BookOpen, GraduationCap } from "lucide-react";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function TeacherDashboard() {
  const { teacher, school, isLoading: teacherLoading } = useTeacherData();

  const teacherName = teacher?.form_data
    ? `${(teacher.form_data as any).primer_nombre || ""} ${(teacher.form_data as any).primer_apellido || ""}`.trim()
    : "Docente";

  const { data: assignmentsCount = 0, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["teacher-assignments-count", teacher?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("subject_teacher_assignments")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacher!.id);
      return count ?? 0;
    },
    enabled: !!teacher?.id,
  });

  const loading = teacherLoading || assignmentsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bienvenido, {teacherName}
          </h1>
          {school?.name && (
            <p className="text-muted-foreground mt-1">{school.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Mis Materias Asignadas"
            value={loading ? "..." : assignmentsCount}
            icon={<BookOpen className="h-10 w-10" />}
            variant="blue"
          />
          <MetricCard
            title="Rol"
            value="Docente"
            icon={<GraduationCap className="h-10 w-10" />}
            variant="cyan"
          />
        </div>

        <div className="bg-card rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Panel del Docente
          </h2>
          <p className="text-muted-foreground">
            Desde aquí puedes consultar tus materias asignadas y descargar tu carnet institucional.
            Utiliza el menú de navegación para acceder a las diferentes secciones.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
