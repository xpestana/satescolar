import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Users, UserCheck, GraduationCap, UsersRound, BookOpen, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function SchoolDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    enrolledStudents: 0,
    totalStudents: 0,
    activeTeachers: 0,
    totalTeachers: 0,
    families: 0,
    subjects: 0,
  });
  const [schoolName, setSchoolName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchoolData = async () => {
      if (!user) return;

      try {
        // Get the school assigned to this user
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("school_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userRole?.school_id) {
          // Fetch school name
          const { data: school } = await supabase
            .from("schools")
            .select("name")
            .eq("id", userRole.school_id)
            .maybeSingle();

          if (school) {
            setSchoolName(school.name);
          }

          // TODO: Fetch real metrics when tables are created
          // For now, all metrics are 0
          setMetrics({
            enrolledStudents: 0,
            totalStudents: 0,
            activeTeachers: 0,
            totalTeachers: 0,
            families: 0,
            subjects: 0,
          });
        }
      } catch (error) {
        console.error("Error fetching school data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolData();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Información General del Registro
          </h1>
          {schoolName && (
            <p className="text-muted-foreground mt-1">{schoolName}</p>
          )}
        </div>

        {/* Metrics Grid - First Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Estudiantes Inscritos"
            value={loading ? "..." : metrics.enrolledStudents}
            icon={<GraduationCap className="h-10 w-10" />}
            variant="blue"
          />
          <MetricCard
            title="Docentes Activos"
            subtitle={`${metrics.totalTeachers} registrados`}
            value={loading ? "..." : metrics.activeTeachers}
            icon={<UserCheck className="h-10 w-10" />}
            variant="cyan"
          />
          <MetricCard
            title="Familias"
            value={loading ? "..." : metrics.families}
            icon={<UsersRound className="h-10 w-10" />}
            variant="orange"
          />
          <MetricCard
            title="Materias"
            value={loading ? "..." : metrics.subjects}
            icon={<BookOpen className="h-10 w-10" />}
            variant="purple"
          />
        </div>

        {/* Second Row - Additional metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Alumnos en el Sistema"
            value={loading ? "..." : metrics.totalStudents}
            icon={<Users className="h-10 w-10" />}
            variant="green"
          />
          <MetricCard
            title="Docentes Registrados"
            value={loading ? "..." : metrics.totalTeachers}
            icon={<UserPlus className="h-10 w-10" />}
            variant="pink"
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
