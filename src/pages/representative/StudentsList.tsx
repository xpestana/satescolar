import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Edit, Download, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { downloadCarnet } from "@/lib/export-utils";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";

export default function StudentsList() {
  const navigate = useNavigate();
  const { familyId, school } = useRepresentativeFamily();

  const { data: students = [] } = useQuery({
    queryKey: ["students", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("family_id", familyId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  const { data: schoolYear } = useQuery({
    queryKey: ["active-school-year", school?.id],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("year_range").eq("school_id", school!.id).eq("is_active", true).single();
      return data?.year_range || "2024-2025";
    },
    enabled: !!school?.id,
  });

  const { data: carnetConfig } = useCarnetConfig(school?.id);
  const getName = (s: any) => {
    const fd = s.form_data as Record<string, any> || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const getStatusLabel = (status: string) => {
    switch (status) { case "active": return "Activo"; case "suspended": return "Suspendido"; case "graduated": return "Graduado"; case "completed": return "Completado"; default: return status; }
  };

  const handleCarnet = async (student: any) => {
    await downloadCarnet({
      personName: getName(student),
      documentId: student.document_id || "Sin documento",
      role: "ESTUDIANTE",
      photoUrl: student.photo_url || undefined,
      schoolName: school?.name || "Institución",
      schoolLocation: school?.address || "",
      schoolLogoUrl: school?.logo_url || undefined,
      schoolYear: schoolYear || "2024-2025",
      primaryColor: carnetConfig?.primary_color || undefined,
      secondaryColor: carnetConfig?.secondary_color || undefined,
      watermarkUrl: carnetConfig?.watermark_url || undefined,
      watermarkOpacity: carnetConfig?.watermark_opacity ? Number(carnetConfig.watermark_opacity) : undefined,
      watermarkSize: carnetConfig?.watermark_size ? Number(carnetConfig.watermark_size) : undefined,
    });
  };

  return (
    <DashboardLayout>
      <PageHeader title="Mis Estudiantes" breadcrumbs={[{ label: "Dashboard", href: "/representative/dashboard" }, { label: "Estudiantes" }]} />
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Estudiantes</h2>
          <Button onClick={() => navigate("/representative/estudiante/nuevo")}>
            <UserPlus className="h-4 w-4 mr-2" /> Agregar Estudiante
          </Button>
        </div>
        {students.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay estudiantes registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => (
              <Card key={student.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={student.photo_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">{getName(student).charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{getName(student)}</p>
                      <p className="text-sm text-muted-foreground">{student.document_id || "Sin doc."}</p>
                      <Badge variant={student.status === "active" ? "default" : "secondary"} className="mt-1">{getStatusLabel(student.status)}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/representative/estudiante/${student.id}/editar`)}>
                      <Edit className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCarnet(student)}>
                      <Download className="h-3 w-3 mr-1" /> Carnet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

    </DashboardLayout>
  );
}
