import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Edit, ChevronDown, GraduationCap, Download, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { downloadCarnet, downloadPlanillaInscripcion } from "@/lib/export-utils";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import { toast } from "sonner";

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

  const handlePlanilla = async (student: any) => {
    if (!school?.id || !familyId) return;
    try {
      toast.info("Generando planilla...");

      // Fetch all data in parallel
      const [familyRes, repRes, sectionsRes, configRes, enrollmentRes, geoRes, formFieldsRes] = await Promise.all([
        supabase.from("families").select("*").eq("id", familyId).single(),
        supabase.from("representatives").select("*").eq("family_id", familyId).eq("is_primary", true).limit(1).maybeSingle(),
        supabase.from("enrollment_planilla_sections").select("*").eq("school_id", school.id).order("display_order"),
        supabase.from("planilla_general_config").select("*").eq("school_id", school.id).maybeSingle(),
        supabase.from("enrollments").select("*, sections(*)").eq("student_id", student.id).eq("school_id", school.id).limit(1).maybeSingle(),
        // Geo data for school
        Promise.all([
          school.state_id ? supabase.from("states").select("name").eq("id", school.state_id).single() : null,
          school.municipality_id ? supabase.from("municipalities").select("name").eq("id", school.municipality_id).single() : null,
          school.city_id ? supabase.from("cities").select("name").eq("id", school.city_id).single() : null,
          school.parish_id ? supabase.from("parishes").select("name").eq("id", school.parish_id).single() : null,
        ]),
        supabase.from("form_fields").select("field_name, field_label, form_type").eq("school_id", school.id).in("form_type", ["student", "representative"]),
      ]);

      // If no primary rep found, fallback to first rep
      let representative = repRes.data;
      if (!representative) {
        const { data: fallbackRep } = await supabase.from("representatives").select("*").eq("family_id", familyId).order("created_at").limit(1).maybeSingle();
        representative = fallbackRep;
      }

      // Resolve family geo (for location_full in family context)
      const familyGeoPromises = await Promise.all([
        familyRes.data?.state_id ? supabase.from("states").select("name").eq("id", familyRes.data.state_id).single() : null,
        familyRes.data?.municipality_id ? supabase.from("municipalities").select("name").eq("id", familyRes.data.municipality_id).single() : null,
        familyRes.data?.city_id ? supabase.from("cities").select("name").eq("id", familyRes.data.city_id).single() : null,
        familyRes.data?.parish_id ? supabase.from("parishes").select("name").eq("id", familyRes.data.parish_id).single() : null,
      ]);

      const [stateRes, muniRes, cityRes, parishRes] = geoRes;
      const familyGeo = {
        state: familyGeoPromises[0]?.data?.name || stateRes?.data?.name,
        municipality: familyGeoPromises[1]?.data?.name || muniRes?.data?.name,
        city: familyGeoPromises[2]?.data?.name || cityRes?.data?.name,
        parish: familyGeoPromises[3]?.data?.name || parishRes?.data?.name,
      };

      // Build geoCache for UUID geographic fields in form_data
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
      const uuidsToResolve = new Set<string>();
      const studentFd = (student.form_data || {}) as Record<string, string>;
      const repFd = (representative?.form_data || {}) as Record<string, string>;
      for (const fd of [studentFd, repFd]) {
        for (const val of Object.values(fd)) {
          if (typeof val === "string" && uuidPattern.test(val)) uuidsToResolve.add(val);
        }
      }
      const geoCache: Record<string, string> = {};
      if (uuidsToResolve.size > 0) {
        const ids = Array.from(uuidsToResolve);
        const [stR, muR, ciR, paR] = await Promise.all([
          supabase.from("states").select("id, name").in("id", ids),
          supabase.from("municipalities").select("id, name").in("id", ids),
          supabase.from("cities").select("id, name").in("id", ids),
          supabase.from("parishes").select("id, name").in("id", ids),
        ]);
        for (const r of (stR.data || [])) geoCache[r.id] = r.name;
        for (const r of (muR.data || [])) geoCache[r.id] = r.name;
        for (const r of (ciR.data || [])) geoCache[r.id] = r.name;
        for (const r of (paR.data || [])) geoCache[r.id] = r.name;
      }

      await downloadPlanillaInscripcion({
        student,
        representative,
        family: familyRes.data,
        school,
        schoolGeo: familyGeo,
        sections: sectionsRes.data || [],
        generalConfig: configRes.data,
        schoolYear: schoolYear || "2024-2025",
        enrollment: enrollmentRes.data,
        enrollmentSection: enrollmentRes.data?.sections,
        formFields: formFieldsRes.data || [],
        geoCache,
      });
    } catch (err) {
      console.error("Error generating planilla:", err);
      toast.error("Error al generar la planilla");
    }
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" /> Descargas <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCarnet(student)}>
                          <Download className="h-3 w-3 mr-2" /> Carnet
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePlanilla(student)}>
                          <FileText className="h-3 w-3 mr-2" /> Planilla de Inscripción
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
