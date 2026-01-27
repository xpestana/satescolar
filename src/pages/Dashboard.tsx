import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { GraduationCap, Users, Calendar, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    schools: 0,
    users: 0,
    events: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch schools count
        const { count: schoolsCount } = await supabase
          .from("schools")
          .select("*", { count: "exact", head: true });

        // Fetch users count (from profiles)
        const { count: usersCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        setMetrics({
          schools: schoolsCount || 0,
          users: usersCount || 0,
          events: 0, // Placeholder - events table not created yet
          students: 0, // Placeholder - students table not created yet
        });
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Colegios"
            value={loading ? "..." : metrics.schools}
            icon={<GraduationCap className="h-10 w-10" />}
            variant="purple"
          />
          <MetricCard
            title="Usuarios"
            value={loading ? "..." : metrics.users}
            icon={<Users className="h-10 w-10" />}
            variant="orange"
          />
          <MetricCard
            title="Eventos"
            value={loading ? "..." : metrics.events}
            icon={<Calendar className="h-10 w-10" />}
            variant="pink"
          />
          <MetricCard
            title="Estudiantes"
            value={loading ? "..." : metrics.students}
            icon={<UserCheck className="h-10 w-10" />}
            variant="green"
          />
        </div>

        {/* Additional content area */}
        <div className="bg-card rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Bienvenido al Panel de Administración
          </h2>
          <p className="text-muted-foreground">
            Desde aquí puedes gestionar todos los aspectos de tu institución educativa.
            Utiliza el menú de navegación para acceder a las diferentes secciones.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
