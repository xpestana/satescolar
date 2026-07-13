import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Edit, ChevronDown, GraduationCap, Download, FileText, BookOpen, Key, Copy, Info, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { downloadCarnet, downloadPlanillaInscripcion } from "@/lib/export-utils";
import { buildGeoCacheFromFormData } from "@/lib/geo-resolve";
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
      const { data } = await supabase.from("school_years").select("id, year_range").eq("school_id", school!.id).eq("is_active", true).single();
      return data ?? { id: null, year_range: "2024-2025" };
    },
    enabled: !!school?.id,
  });

  const { data: carnetConfig } = useCarnetConfig(school?.id);

  // Fetch access codes for all students
  const { data: accessCodes = [] } = useQuery({
    queryKey: ["classroom-access-codes", familyId, school?.id],
    queryFn: async () => {
      const studentIds = students.map((s) => s.id);
      if (!studentIds.length) return [];
      const { data } = await supabase
        .from("classroom_access_codes")
        .select("student_id, access_code, is_active")
        .in("student_id", studentIds)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!familyId && students.length > 0,
  });

  const getAccessCode = (studentId: string) => accessCodes.find((c) => c.student_id === studentId);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado al portapapeles");
  };

  const getName = (s: any) => {
    const fd = s.form_data as Record<string, any> || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const getStatusLabel = (status: string) => {
    switch (status) { case "active": return "Activo"; case "suspended": return "Suspendido"; case "graduated": return "Graduado"; case "completed": return "Completado"; default: return status; }
  };

  const handleCarnet = async (student: any) => {
    const { data: tokenData } = await supabase
      .from("attendance_tokens")
      .select("token")
      .eq("entity_type", "student")
      .eq("entity_id", student.id)
      .maybeSingle();
    await downloadCarnet({
      personName: getName(student),
      documentId: student.document_id || "Sin documento",
      role: "ESTUDIANTE",
      photoUrl: student.photo_url || undefined,
      schoolName: school?.name || "Institución",
      schoolLocation: school?.address || "",
      schoolLogoUrl: school?.logo_url || undefined,
      schoolYear: schoolYear?.year_range || "2024-2025",
      primaryColor: carnetConfig?.primary_color || undefined,
      secondaryColor: carnetConfig?.secondary_color || undefined,
      watermarkUrl: carnetConfig?.watermark_url || undefined,
      watermarkOpacity: carnetConfig?.watermark_opacity ? Number(carnetConfig.watermark_opacity) : undefined,
      watermarkSize: carnetConfig?.watermark_size ? Number(carnetConfig.watermark_size) : undefined,
      layoutConfig: (carnetConfig?.layout_config as any) || undefined,
      attendanceToken: tokenData?.token || undefined,
    });
  };

  const handlePlanilla = async (student: any) => {
    if (!school?.id || !familyId) return;
    try {
      toast.info("Generando planilla...");

      const [familyRes, repRes, sectionsRes, configRes, enrollmentRes, geoRes, formFieldsRes, blocksRes] = await Promise.all([
        supabase.from("families").select("*").eq("id", familyId).single(),
        supabase.from("representatives").select("*").eq("family_id", familyId).eq("is_primary", true).limit(1).maybeSingle(),
        supabase.from("enrollment_planilla_sections").select("*").eq("school_id", school.id).order("display_order"),
        supabase.from("planilla_general_config").select("*").eq("school_id", school.id).maybeSingle(),
        schoolYear?.id
          ? supabase.from("enrollments").select("*, sections(*)").eq("student_id", student.id).eq("school_id", school.id).eq("school_year_id", schoolYear.id).maybeSingle()
          : supabase.from("enrollments").select("*, sections(*)").eq("student_id", student.id).eq("school_id", school.id).limit(1).maybeSingle(),
        Promise.all([
          school.state_id ? supabase.from("states").select("name").eq("id", school.state_id).single() : null,
          school.municipality_id ? supabase.from("municipalities").select("name").eq("id", school.municipality_id).single() : null,
          school.city_id ? supabase.from("cities").select("name").eq("id", school.city_id).single() : null,
          school.parish_id ? supabase.from("parishes").select("name").eq("id", school.parish_id).single() : null,
        ]),
        supabase.from("form_fields").select("field_name, field_label, form_type").eq("school_id", school.id).in("form_type", ["student", "representative"]),
        supabase.from("planilla_signature_blocks" as any).select("*").eq("school_id", school.id).order("display_order"),
      ]);

      let representative = repRes.data;
      if (!representative) {
        const { data: fallbackRep } = await supabase.from("representatives").select("*").eq("family_id", familyId).order("created_at").limit(1).maybeSingle();
        representative = fallbackRep;
      }

      const familyGeoPromises = await Promise.all([
        familyRes.data?.state_id ? supabase.from("states").select("name").eq("id", familyRes.data.state_id).single() : null,
        familyRes.data?.municipality_id ? supabase.from("municipalities").select("name").eq("id", familyRes.data.municipality_id).single() : null,
        familyRes.data?.city_id ? supabase.from("cities").select("name").eq("id", familyRes.data.city_id).single() : null,
        familyRes.data?.parish_id ? supabase.from("parishes").select("name").eq("id", familyRes.data.parish_id).single() : null,
      ]);

      const [stateRes, muniRes, cityRes, parishRes] = geoRes;
      const planillaSchoolGeo = {
        state: familyGeoPromises[0]?.data?.name || stateRes?.data?.name,
        municipality: familyGeoPromises[1]?.data?.name || muniRes?.data?.name,
        city: familyGeoPromises[2]?.data?.name || cityRes?.data?.name,
        parish: familyGeoPromises[3]?.data?.name || parishRes?.data?.name,
      };

      const studentFullData = {
        ...student,
        form_data: student.form_data || {},
      };

      const geoCache = await buildGeoCacheFromFormData([
        student.form_data || {},
        (representative?.form_data || {}) as Record<string, unknown>,
        (familyRes.data || {}) as Record<string, unknown>,
      ]);

      await downloadPlanillaInscripcion({
        student: studentFullData,
        representative,
        family: familyRes.data,
        school,
        schoolGeo: planillaSchoolGeo,
        sections: sectionsRes.data || [],
        generalConfig: configRes.data,
        schoolYear: schoolYear?.year_range || "2024-2025",
        enrollment: enrollmentRes.data,
        enrollmentSection: enrollmentRes.data?.sections,
        formFields: formFieldsRes.data || [],
        geoCache,
        signatureBlocks: (blocksRes as any).data || [],
      });
    } catch (err) {
      console.error("Error generating planilla:", err);
      toast.error("Error al generar la planilla");
    }
  };

  const [tutorialOpen, setTutorialOpen] = useState(true);

  return (
    <DashboardLayout>
      <PageHeader title="Mis Estudiantes" breadcrumbs={[{ label: "Dashboard", href: "/representative/dashboard" }, { label: "Estudiantes" }]} />

      {/* Tutorial: Cómo acceder al Aula Virtual */}
      <Collapsible open={tutorialOpen} onOpenChange={setTutorialOpen} className="mb-6">
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span className="font-medium text-sm">¿Cómo acceder al Aula Virtual de mi representado?</span>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-2">
                {tutorialOpen ? "Ocultar" : "Ver tutorial"}
              </Button>
            </CollapsibleTrigger>
          </AlertDescription>
        </Alert>
        <CollapsibleContent>
          <Card className="mt-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                  <div>
                    <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                      <Key className="h-4 w-4 text-primary" /> Copiar el Código
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cada estudiante inscrito tiene un <strong>Código Aula</strong> visible en su tarjeta. Presione el ícono de copiar para guardarlo.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                  <div>
                    <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                      <MonitorSmartphone className="h-4 w-4 text-primary" /> Entrar al Aula Virtual
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Presione el botón <strong>"Aula Virtual"</strong> en la tarjeta del estudiante para acceder a la pantalla de verificación.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                  <div>
                    <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Verificar Acceso
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pegue el código copiado en el campo de verificación y presione <strong>"Verificar Acceso"</strong>. Podrá ver materias, actividades y calificaciones.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

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
                  {/* Access code display */}
                  {getAccessCode(student.id) && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
                      <Key className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">Código Aula:</span>
                      <code className="text-xs font-mono font-semibold tracking-wider">{getAccessCode(student.id)!.access_code}</code>
                      <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => copyCode(getAccessCode(student.id)!.access_code)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/representative/estudiante/${student.id}/editar`)}>
                      <Edit className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/representative/aula-virtual/${student.id}`)}>
                      <BookOpen className="h-3 w-3 mr-1" /> Aula Virtual
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
