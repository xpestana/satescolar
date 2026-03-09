import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EnrollmentBySectionChart } from "@/components/dashboard/EnrollmentBySectionChart";
import { GrowthByYearChart } from "@/components/dashboard/GrowthByYearChart";
import { GradeLevelDistributionChart } from "@/components/dashboard/GradeLevelDistributionChart";
import { TeacherWorkloadChart } from "@/components/dashboard/TeacherWorkloadChart";
import { EnrollmentTypeChart } from "@/components/dashboard/EnrollmentTypeChart";
import { Users, UserCheck, GraduationCap, UsersRound, BookOpen, UserPlus, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useQuery } from "@tanstack/react-query";

export default function SchoolDashboard() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();

  // Get active school year
  const { data: activeSchoolYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("id")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Enrolled students (in active school year)
  const { data: enrolledStudents = 0, isLoading: l1 } = useQuery({
    queryKey: ["metric-enrolled", schoolId, activeSchoolYear?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeSchoolYear!.id);
      return count ?? 0;
    },
    enabled: !!schoolId && !!activeSchoolYear?.id,
  });

  // Total students in system (via student_schools)
  const { data: totalStudents = 0, isLoading: l2 } = useQuery({
    queryKey: ["metric-total-students", schoolId],
    queryFn: async () => {
      const { count } = await supabase
        .from("student_schools")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId!);
      return count ?? 0;
    },
    enabled: !!schoolId,
  });

  // Active teachers (not suspended)
  const { data: activeTeachers = 0, isLoading: l3 } = useQuery({
    queryKey: ["metric-active-teachers", schoolId],
    queryFn: async () => {
      const { count } = await supabase
        .from("teachers")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId!)
        .eq("is_suspended", false);
      return count ?? 0;
    },
    enabled: !!schoolId,
  });

  // Total teachers
  const { data: totalTeachers = 0, isLoading: l4 } = useQuery({
    queryKey: ["metric-total-teachers", schoolId],
    queryFn: async () => {
      const { count } = await supabase
        .from("teachers")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId!);
      return count ?? 0;
    },
    enabled: !!schoolId,
  });

  // Families (only those whose user has the 'representative' role)
  const { data: familiesCount = 0, isLoading: l5 } = useQuery({
    queryKey: ["metric-families", schoolId],
    queryFn: async () => {
      // Get family_ids linked to this school
      const { data: fsRows } = await supabase
        .from("family_schools")
        .select("family_id")
        .eq("school_id", schoolId!);
      if (!fsRows || fsRows.length === 0) return 0;

      const familyIds = fsRows.map((r) => r.family_id);

      // Get user_ids for those families
      const { data: families } = await supabase
        .from("families")
        .select("user_id")
        .in("id", familyIds);
      if (!families || families.length === 0) return 0;

      const userIds = families.map((f) => f.user_id);

      // Filter only users with 'representative' role
      const { data: repRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "representative")
        .in("user_id", userIds);

      return repRoles?.length ?? 0;
    },
    enabled: !!schoolId,
  });

  // Subjects (not suspended)
  const { data: subjectsCount = 0, isLoading: l6 } = useQuery({
    queryKey: ["metric-subjects", schoolId],
    queryFn: async () => {
      const { count } = await supabase
        .from("school_subjects")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId!)
        .eq("is_suspended", false);
      return count ?? 0;
    },
    enabled: !!schoolId,
  });

  // Assigned subjects in active school year
  const { data: assignedSubjects = 0, isLoading: l7 } = useQuery({
    queryKey: ["metric-assigned-subjects", schoolId, activeSchoolYear?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("subject_teacher_assignments")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeSchoolYear!.id)
        .eq("is_suspended", false);
      return count ?? 0;
    },
    enabled: !!schoolId && !!activeSchoolYear?.id,
  });

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Información General del Registro
          </h1>
        {school?.name && (
            <p className="text-muted-foreground mt-1">{school.name}</p>
          )}
        </div>

        {/* Metrics Grid - First Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Estudiantes Inscritos"
            value={loading ? "..." : enrolledStudents}
            icon={<GraduationCap className="h-10 w-10" />}
            variant="blue"
          />
          <MetricCard
            title="Docentes Activos"
            subtitle={`${totalTeachers} registrados`}
            value={loading ? "..." : activeTeachers}
            icon={<UserCheck className="h-10 w-10" />}
            variant="cyan"
          />
          <MetricCard
            title="Familias"
            value={loading ? "..." : familiesCount}
            icon={<UsersRound className="h-10 w-10" />}
            variant="orange"
          />
          <MetricCard
            title="Materias"
            value={loading ? "..." : subjectsCount}
            icon={<BookOpen className="h-10 w-10" />}
            variant="purple"
          />
        </div>

        {/* Second Row - Additional metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Alumnos en el Sistema"
            value={loading ? "..." : totalStudents}
            icon={<Users className="h-10 w-10" />}
            variant="green"
          />
          <MetricCard
            title="Docentes Registrados"
            value={loading ? "..." : totalTeachers}
            icon={<UserPlus className="h-10 w-10" />}
            variant="pink"
          />
          <MetricCard
            title="Áreas Asignadas"
            value={loading ? "..." : assignedSubjects}
            icon={<ClipboardList className="h-10 w-10" />}
            variant="cyan"
          />
        </div>

        {/* Welcome Card */}
        <div className="bg-card rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Bienvenido al Panel Escolar
          </h2>
          <p className="text-muted-foreground">
            Desde aquí puedes gestionar todos los aspectos de tu institución educativa.
            Utiliza el menú de navegación para acceder a las diferentes secciones como
            Familias, Pagos y Ajustes del colegio.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
