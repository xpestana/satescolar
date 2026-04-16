import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClassroomAssignments, useClassroomConfig, type ClassroomAssignment } from "@/hooks/useClassroomData";
import { useTeacherData } from "@/hooks/useTeacherData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClassroomListTutorial } from "@/components/classroom/ClassroomTutorial";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
  i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
  primaria: "Primaria", "1_grado": "1er Grado", "2_grado": "2do Grado",
  "3_grado": "3er Grado", "4_grado": "4to Grado", "5_grado": "5to Grado",
  "6_grado": "6to Grado", media_general: "Media General",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", media_tecnica: "Media Técnica", "6_ano": "6to Año",
};

function ClassroomCard({ assignment }: { assignment: ClassroomAssignment }) {
  const navigate = useNavigate();
  const { data: config } = useQuery({
    queryKey: ["classroom-config", assignment.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_config")
        .select("color, description, cover_url")
        .eq("assignment_id", assignment.id)
        .maybeSingle();
      return data;
    },
  });

  const color = config?.color || "#4285f4";
  const sectionLabel = assignment.section
    ? `${GRADE_LABELS[assignment.section.grade_level] || assignment.section.grade_level} - Sección ${assignment.section.name}`
    : assignment.subject?.subject_type === "gcrp" ? "GCRP" : "Sin sección";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all group"
      onClick={() => navigate(`/teacher/aula-virtual/${assignment.id}`)}
    >
      <div className="h-24 relative" style={{ backgroundColor: color }}>
        {config?.cover_url && (
          <img src={config.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white font-semibold text-lg truncate drop-shadow-md">
            {assignment.subject?.name}
          </h3>
          <p className="text-white/90 text-sm truncate drop-shadow-sm">{sectionLabel}</p>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">{assignment.school_year?.year_range}</Badge>
            {assignment.school_year?.is_active && (
              <Badge variant="default" className="text-xs">Activo</Badge>
            )}
          </div>
          <Settings className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {config?.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{config.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClassroomList() {
  const { isLoading: teacherLoading } = useTeacherData();
  const { data: assignments = [], isLoading } = useClassroomAssignments();

  const loading = teacherLoading || isLoading;

  const grouped = assignments.reduce<Record<string, ClassroomAssignment[]>>((acc, a) => {
    const key = a.school_year?.year_range || "Sin año";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <PageHeader
        title="Aula Virtual"
        breadcrumbs={[{ label: "Inicio", href: "/teacher/dashboard" }, { label: "Aula Virtual" }]}
      />

      <ClassroomListTutorial />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Sin aulas disponibles</h3>
          <p className="text-muted-foreground mt-1">No tienes materias asignadas para el aula virtual.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([year, items]) => (
            <div key={year}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {year}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((a) => (
                  <ClassroomCard key={a.id} assignment={a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
