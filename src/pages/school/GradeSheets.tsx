import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Download, FileText, Users, Info, Hammer, Settings2, Building2, Hash } from "lucide-react";
import { DocumentBuilder } from "@/components/utilities/DocumentBuilder";
import { usePlanillasConfig } from "@/hooks/usePlanillasConfig";
import { DatosComunes } from "@/components/planillas/config/DatosComunes";
import { CodigosEducacion } from "@/components/planillas/config/CodigosEducacion";
import { ConfiguracionRFRE } from "@/components/planillas/config/ConfiguracionRFRE";
import { useSabanaConfig } from "@/hooks/useSabanaConfig";
import { SabanaConfigPanel } from "@/components/planillas/sabana/SabanaConfigPanel";
import { SabanaPreview } from "@/components/planillas/sabana/SabanaPreview";
import { generateSabanaPdf, SECONDARY_GRADES, GRADE_LABELS, StudentRow } from "@/lib/sabana-pdf";
import jsPDF from "jspdf";
import { addArialFont } from "@/lib/pdf-fonts";

export default function GradeSheets() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedMomento, setSelectedMomento] = useState<string>("1");
  const [downloading, setDownloading] = useState<string | null>(null);
  const planillasConfig = usePlanillasConfig();
  const { config: sabanaConfig, updateConfig, resetConfig } = useSabanaConfig();

  const { data: schoolYears } = useQuery({
    queryKey: ["school-years", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years").select("*").eq("school_id", schoolId!).order("year_range", { ascending: false });
      return data || [];
    },
    enabled: !!schoolId,
  });

  useMemo(() => {
    if (schoolYears?.length && !selectedYearId) {
      const active = schoolYears.find(y => y.is_active);
      setSelectedYearId(active?.id || schoolYears[0].id);
    }
  }, [schoolYears, selectedYearId]);

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["secondary-sections-with-enrollments", schoolId, selectedYearId],
    queryFn: async () => {
      if (!schoolId || !selectedYearId) return [];
      const { data: sections } = await supabase
        .from("sections").select("*").eq("school_id", schoolId)
        .in("grade_level", [...SECONDARY_GRADES]);
      if (!sections?.length) return [];

      const { data: enrollments } = await supabase
        .from("enrollments").select("section_id, student_id")
        .eq("school_id", schoolId).eq("school_year_id", selectedYearId);

      const enrollmentsBySection = new Map<string, string[]>();
      enrollments?.forEach(e => {
        const arr = enrollmentsBySection.get(e.section_id) || [];
        arr.push(e.student_id);
        enrollmentsBySection.set(e.section_id, arr);
      });

      return sections
        .filter(s => (enrollmentsBySection.get(s.id)?.length || 0) > 0)
        .map(s => ({
          ...s,
          studentCount: enrollmentsBySection.get(s.id)?.length || 0,
          studentIds: enrollmentsBySection.get(s.id) || [],
        }))
        .sort((a, b) => {
          const idxA = SECONDARY_GRADES.indexOf(a.grade_level as any);
          const idxB = SECONDARY_GRADES.indexOf(b.grade_level as any);
          if (idxA !== idxB) return idxA - idxB;
          return a.name.localeCompare(b.name);
        });
    },
    enabled: !!schoolId && !!selectedYearId,
  });

  async function fetchSectionData(sectionId: string, studentIds: string[]) {
    if (!schoolId || !selectedYearId) return null;

    const { data: students } = await supabase
      .from("students").select("id, document_id, form_data")
      .in("id", studentIds);
    if (!students?.length) return null;

    const { data: regularAssignments } = await supabase
      .from("subject_teacher_assignments")
      .select("id, subject_id, school_subjects(id, name, abbreviation, display_order, show_in_planilla)")
      .eq("school_id", schoolId).eq("school_year_id", selectedYearId)
      .eq("section_id", sectionId).eq("is_suspended", false);

    const { data: gcrpLinks } = await supabase
      .from("gcrp_assignment_students")
      .select("assignment_id")
      .eq("school_id", schoolId)
      .in("student_id", studentIds);

    const gcrpAssignmentIds = [...new Set((gcrpLinks || []).map(l => l.assignment_id))];
    let gcrpAssignments: any[] = [];
    if (gcrpAssignmentIds.length > 0) {
      const { data } = await supabase
        .from("subject_teacher_assignments")
        .select("id, subject_id, school_subjects(id, name, abbreviation, display_order, show_in_planilla)")
        .in("id", gcrpAssignmentIds)
        .eq("school_year_id", selectedYearId)
        .eq("is_suspended", false);
      gcrpAssignments = data || [];
    }

    const allAssignments = [...(regularAssignments || []), ...gcrpAssignments];
    const seenIds = new Set<string>();
    const validAssignments = allAssignments
      .filter(a => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return (a.school_subjects as any)?.show_in_planilla !== false;
      })
      .sort((a, b) => {
        const aIsGcrp = !(regularAssignments || []).some(r => r.id === a.id);
        const bIsGcrp = !(regularAssignments || []).some(r => r.id === b.id);
        if (aIsGcrp !== bIsGcrp) return aIsGcrp ? 1 : -1;
        return ((a.school_subjects as any)?.display_order || 0) - ((b.school_subjects as any)?.display_order || 0);
      });

    const assignmentIds = validAssignments.map(a => a.id);

    const gcrpStudentMap = new Map<string, Set<string>>();
    if (gcrpAssignmentIds.length > 0) {
      const { data: allGcrpLinks } = await supabase
        .from("gcrp_assignment_students")
        .select("assignment_id, student_id")
        .in("assignment_id", gcrpAssignmentIds)
        .in("student_id", studentIds);
      (allGcrpLinks || []).forEach(l => {
        if (!gcrpStudentMap.has(l.assignment_id)) gcrpStudentMap.set(l.assignment_id, new Set());
        gcrpStudentMap.get(l.assignment_id)!.add(l.student_id);
      });
    }

    const regularAssignmentIds = new Set((regularAssignments || []).map(a => a.id));

    let allGrades: any[] = [];
    if (assignmentIds.length > 0) {
      if (selectedMomento === "definitiva") {
        const { data } = await supabase
          .from("final_grades").select("*")
          .eq("school_id", schoolId).in("assignment_id", assignmentIds)
          .in("student_id", studentIds).in("momento", [1, 2, 3]);
        allGrades = data || [];
      } else {
        const { data } = await supabase
          .from("final_grades").select("*")
          .eq("school_id", schoolId).in("assignment_id", assignmentIds)
          .in("student_id", studentIds).eq("momento", parseInt(selectedMomento));
        allGrades = data || [];
      }
    }

    const rows: StudentRow[] = students.map(student => {
      const fd = (student.form_data || {}) as any;
      const fullName = [fd.primer_apellido, fd.segundo_apellido, fd.primer_nombre, fd.segundo_nombre]
        .filter(Boolean).join(" ");

      const grades: StudentRow["grades"] = {};
      const momentoDetail: StudentRow["momentoDetail"] = {};
      let totalGrades = 0, gradeSum = 0, failedCount = 0;

      validAssignments.forEach(assignment => {
        const subjectId = assignment.subject_id;
        const isGcrp = !regularAssignmentIds.has(assignment.id);

        if (isGcrp) {
          const enrolledStudents = gcrpStudentMap.get(assignment.id);
          if (!enrolledStudents || !enrolledStudents.has(student.id)) {
            grades[subjectId] = { value: null, adjustment: 0 };
            momentoDetail[subjectId] = { m1: null, m2: null, m3: null, adj1: 0, adj2: 0, adj3: 0, avg: null };
            return;
          }
        }

        if (selectedMomento === "definitiva") {
          const detail = { m1: null as number | null, m2: null as number | null, m3: null as number | null, adj1: 0, adj2: 0, adj3: 0, avg: null as number | null };
          const momentGrades: (number | null)[] = [];
          [1, 2, 3].forEach(m => {
            const g = allGrades.find(g => g.student_id === student.id && g.assignment_id === assignment.id && g.momento === m);
            if (g && g.grade_value != null) {
              const val = parseFloat(g.grade_value || "0") + (g.adjustment_points || 0);
              const adj = g.adjustment_points || 0;
              if (m === 1) { detail.m1 = val; detail.adj1 = adj; }
              if (m === 2) { detail.m2 = val; detail.adj2 = adj; }
              if (m === 3) { detail.m3 = val; detail.adj3 = adj; }
              momentGrades.push(val);
            } else {
              momentGrades.push(null);
            }
          });
          const validMoments = momentGrades.filter(v => v !== null) as number[];
          if (validMoments.length > 0) {
            const avg = Math.round((validMoments.reduce((s, v) => s + v, 0) / validMoments.length) * 10) / 10;
            detail.avg = avg;
            grades[subjectId] = { value: avg, adjustment: 0 };
            gradeSum += avg; totalGrades++;
            if (avg < 10) failedCount++;
          } else {
            grades[subjectId] = { value: null, adjustment: 0 };
          }
          momentoDetail[subjectId] = detail;
        } else {
          const g = allGrades.find(g => g.student_id === student.id && g.assignment_id === assignment.id);
          if (g && g.grade_value != null) {
            const val = parseFloat(g.grade_value) + (g.adjustment_points || 0);
            grades[subjectId] = { value: val, adjustment: g.adjustment_points || 0 };
            gradeSum += val; totalGrades++;
            if (val < 10) failedCount++;
          } else {
            grades[subjectId] = { value: null, adjustment: 0 };
          }
          momentoDetail[subjectId] = { m1: null, m2: null, m3: null, adj1: 0, adj2: 0, adj3: 0, avg: null };
        }
      });

      return {
        studentId: student.id,
        documentId: student.document_id || "",
        fullName,
        grades,
        momentoDetail,
        average: totalGrades > 0 ? Math.round((gradeSum / totalGrades) * 10) / 10 : null,
        position: 0,
        failedCount,
      };
    });

    rows.sort((a, b) => a.documentId.localeCompare(b.documentId, undefined, { numeric: true }));
    const ranked = [...rows].filter(r => r.average !== null).sort((a, b) => (b.average || 0) - (a.average || 0));
    ranked.forEach((r, i) => { r.position = i + 1; });
    rows.forEach(r => {
      const found = ranked.find(rk => rk.studentId === r.studentId);
      if (found) r.position = found.position;
    });

    return { students: rows, assignments: validAssignments };
  }

  async function handleDownloadSection(section: any) {
    setDownloading(section.id);
    try {
      const data = await fetchSectionData(section.id, section.studentIds);
      if (!data || !data.students.length) {
        toast.error("No se encontraron estudiantes para esta sección");
        return;
      }
      const doc = new jsPDF({ orientation: "landscape", format: "a4" });
      await addArialFont(doc);
      const year = schoolYears?.find(y => y.id === selectedYearId);
      generateSabanaPdf(doc, section.name, section.grade_level, year?.year_range || "", data, false, selectedMomento, school?.name || "", sabanaConfig);
      const momentoLabel = selectedMomento === "definitiva" ? "Definitiva" : `Momento_${selectedMomento}`;
      const schoolName = (school?.name || "Colegio").replace(/\s+/g, "_");
      doc.save(`Sabana_de_Notas_${schoolName}_${GRADE_LABELS[section.grade_level]}_Seccion_${section.name}_${momentoLabel}_${year?.year_range || ""}.pdf`);
      toast.success("PDF descargado exitosamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAll() {
    if (!sectionsData?.length) return;
    setDownloading("all");
    try {
      const doc = new jsPDF({ orientation: "landscape", format: "a4" });
      await addArialFont(doc);
      const year = schoolYears?.find(y => y.id === selectedYearId);
      let first = true;

      for (const section of sectionsData) {
        const data = await fetchSectionData(section.id, section.studentIds);
        if (!data) continue;
        generateSabanaPdf(doc, section.name, section.grade_level, year?.year_range || "", data, !first, selectedMomento, school?.name || "", sabanaConfig);
        first = false;
      }

      if (first) {
        toast.error("No se encontraron datos para generar");
        return;
      }

      const momentoLabel = selectedMomento === "definitiva" ? "Definitiva" : `Momento_${selectedMomento}`;
      const schoolName = (school?.name || "Colegio").replace(/\s+/g, "_");
      doc.save(`Sabana_de_Notas_${schoolName}_Todas_las_Secciones_${momentoLabel}_${year?.year_range || ""}.pdf`);
      toast.success("PDF descargado exitosamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Planillas" breadcrumbs={[{ label: "Utilidades" }, { label: "Planillas" }]} />

        <Tabs defaultValue="constructor" className="w-full">
          <TabsList>
            <TabsTrigger value="constructor" className="gap-1.5">
              <Hammer className="h-3.5 w-3.5" /> Constructor
            </TabsTrigger>
            <TabsTrigger value="sabana" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Sábana de Notas
            </TabsTrigger>
            <TabsTrigger value="configuraciones" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Configuraciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="constructor" className="mt-4">
            <DocumentBuilder />
          </TabsContent>

          <TabsContent value="sabana" className="mt-4 space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border/50">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">¿Cómo usar la Sábana de Notas?</span></p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>Configura la apariencia del PDF en el panel izquierdo.</li>
                  <li>Selecciona el <strong>Año Escolar</strong> y el <strong>Momento</strong>.</li>
                  <li>Haz clic en <Download className="h-3.5 w-3.5 inline-block align-text-bottom" /> de cada sección para descargar su PDF individual.</li>
                  <li>Usa <strong>"Descargar Todas"</strong> para un único PDF con todas las secciones.</li>
                </ol>
                <p className="text-xs text-muted-foreground/80 mt-1">En la Definitiva Anual, el PDF muestra las notas de los 3 momentos junto al promedio por materia.</p>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex gap-5 items-start">
              {/* ── LEFT PANEL ── */}
              <div className="w-72 shrink-0 space-y-4">
                {/* Config card */}
                <SabanaConfigPanel
                  config={sabanaConfig}
                  onUpdate={updateConfig}
                  onReset={resetConfig}
                />

                {/* Filters */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Filtros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Año Escolar</label>
                      <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                        <SelectTrigger className="w-full h-8 text-sm">
                          <SelectValue placeholder="Seleccionar año" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolYears?.map(y => (
                            <SelectItem key={y.id} value={y.id}>
                              {y.year_range} {y.is_active ? "(Activo)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Momento</label>
                      <Select value={selectedMomento} onValueChange={setSelectedMomento}>
                        <SelectTrigger className="w-full h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Momento 1</SelectItem>
                          <SelectItem value="2">Momento 2</SelectItem>
                          <SelectItem value="3">Momento 3</SelectItem>
                          <SelectItem value="definitiva">Definitiva Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Section list */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" /> Secciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {sectionsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))
                    ) : !sectionsData?.length ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No hay secciones con alumnos inscritos.
                      </p>
                    ) : (
                      <>
                        {sectionsData.map(section => (
                          <div
                            key={section.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold leading-tight">
                                {GRADE_LABELS[section.grade_level] || section.grade_level} - {section.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Users className="h-2.5 w-2.5" />
                                {section.studentCount} estudiantes
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDownloadSection(section)}
                              disabled={downloading === section.id}
                              title={`Descargar ${GRADE_LABELS[section.grade_level]} - ${section.name}`}
                            >
                              {downloading === section.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        ))}

                        {sectionsData.length > 0 && (
                          <Button
                            onClick={handleDownloadAll}
                            disabled={downloading === "all"}
                            className="w-full mt-1"
                            size="sm"
                          >
                            {downloading === "all"
                              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              : <Download className="h-4 w-4 mr-2" />
                            }
                            Descargar Todas
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── RIGHT PANEL: Preview ── */}
              <div className="flex-1 min-w-0">
                <SabanaPreview config={sabanaConfig} momento={selectedMomento} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="configuraciones" className="mt-4">
            <Tabs defaultValue="datos-comunes" orientation="vertical">
              <div className="flex gap-5 items-start">
                <TabsList className="flex flex-col w-52 shrink-0 h-auto items-stretch justify-start gap-0.5 rounded-xl border bg-card p-2 shadow-sm">
                  <p className="px-3 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Secciones
                  </p>
                  {([
                    { value: "datos-comunes", icon: Building2, label: "Datos comunes" },
                    { value: "codigos",       icon: Hash,      label: "Códigos" },
                    { value: "rfre",          icon: Settings2, label: "Configuraciones RFRE" },
                  ] as const).map(({ value, icon: Icon, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex items-center gap-2.5 justify-start px-3 py-2.5 h-auto rounded-lg text-sm text-muted-foreground font-medium shadow-none bg-transparent
                        hover:bg-muted hover:text-foreground
                        data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex-1 min-w-0">
                  <TabsContent value="datos-comunes" className="mt-0">
                    <DatosComunes
                      schoolHeader={planillasConfig.schoolHeader}
                      saveSchoolHeader={planillasConfig.saveSchoolHeader}
                      isLoading={planillasConfig.isLoading}
                    />
                  </TabsContent>
                  <TabsContent value="codigos" className="mt-0">
                    <CodigosEducacion
                      educationCodes={planillasConfig.educationCodes}
                      saveEducationCodes={planillasConfig.saveEducationCodes}
                      isLoading={planillasConfig.isLoading}
                    />
                  </TabsContent>
                  <TabsContent value="rfre" className="mt-0">
                    <ConfiguracionRFRE
                      rfreConfig={planillasConfig.rfreConfig}
                      saveRfreConfig={planillasConfig.saveRfreConfig}
                      isLoading={planillasConfig.isLoading}
                    />
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
