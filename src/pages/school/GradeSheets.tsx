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
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Download, FileText, Users, Construction } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SECONDARY_GRADES = ["1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano"] as const;

const GRADE_LABELS: Record<string, string> = {
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", "6_ano": "6to Año",
};

interface StudentRow {
  studentId: string;
  documentId: string;
  fullName: string;
  grades: Record<string, { value: number | null; adjustment: number }>;
  average: number | null;
  position: number;
  failedCount: number;
}

export default function GradeSheets() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedMomento, setSelectedMomento] = useState<string>("1");
  const [downloading, setDownloading] = useState<string | null>(null);

  // School years
  const { data: schoolYears } = useQuery({
    queryKey: ["school-years", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years").select("*").eq("school_id", schoolId!).order("year_range", { ascending: false });
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Auto-select active year
  useState(() => {
    if (schoolYears?.length && !selectedYearId) {
      const active = schoolYears.find(y => y.is_active);
      setSelectedYearId(active?.id || schoolYears[0].id);
    }
  });

  // When schoolYears load, auto-select
  useMemo(() => {
    if (schoolYears?.length && !selectedYearId) {
      const active = schoolYears.find(y => y.is_active);
      setSelectedYearId(active?.id || schoolYears[0].id);
    }
  }, [schoolYears, selectedYearId]);

  // Sections with enrollments for selected year (secondary only)
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["secondary-sections-with-enrollments", schoolId, selectedYearId],
    queryFn: async () => {
      if (!schoolId || !selectedYearId) return [];
      // Get all secondary sections
      const { data: sections } = await supabase
        .from("sections").select("*").eq("school_id", schoolId)
        .in("grade_level", [...SECONDARY_GRADES]);
      if (!sections?.length) return [];

      // Get enrollments for each section in this year
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

    // Get students
    const { data: students } = await supabase
      .from("students").select("id, document_id, form_data")
      .in("id", studentIds);
    if (!students?.length) return null;

    // Get regular assignments for this section
    const { data: regularAssignments } = await supabase
      .from("subject_teacher_assignments")
      .select("id, subject_id, school_subjects(id, name, abbreviation, display_order, show_in_planilla)")
      .eq("school_id", schoolId).eq("school_year_id", selectedYearId)
      .eq("section_id", sectionId).eq("is_suspended", false);

    // Get GCRP assignments that include students from this section
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

    // Combine: regular first (sorted by display_order), then GCRP (sorted by display_order)
    const allAssignments = [...(regularAssignments || []), ...gcrpAssignments];

    // Filter to subjects that show_in_planilla, deduplicate by assignment id, and sort (regular first, GCRP last)
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

    // Build a map of GCRP assignment -> enrolled student ids
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

    // Get final grades
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

    // Build student rows
    const rows: StudentRow[] = students.map(student => {
      const fd = (student.form_data || {}) as any;
      const apellido1 = fd.primer_apellido || "";
      const apellido2 = fd.segundo_apellido || "";
      const nombre1 = fd.primer_nombre || "";
      const nombre2 = fd.segundo_nombre || "";
      const fullName = [apellido1, apellido2, nombre1, nombre2].filter(Boolean).join(" ");

      const grades: Record<string, { value: number | null; adjustment: number }> = {};
      let totalGrades = 0;
      let gradeSum = 0;
      let failedCount = 0;

      validAssignments.forEach(assignment => {
        const subjectId = assignment.subject_id;
        if (selectedMomento === "definitiva") {
          const momentGrades = [1, 2, 3].map(m => {
            const g = allGrades.find(g => g.student_id === student.id && g.assignment_id === assignment.id && g.momento === m);
            return g ? parseFloat(g.grade_value || "0") + (g.adjustment_points || 0) : null;
          });
          const validMoments = momentGrades.filter(v => v !== null) as number[];
          const hasAdjustment = allGrades.some(g => g.student_id === student.id && g.assignment_id === assignment.id && (g.adjustment_points || 0) !== 0);
          if (validMoments.length > 0) {
            const avg = Math.round((validMoments.reduce((s, v) => s + v, 0) / validMoments.length) * 10) / 10;
            grades[subjectId] = { value: avg, adjustment: hasAdjustment ? 1 : 0 };
            gradeSum += avg;
            totalGrades++;
            if (avg < 10) failedCount++;
          } else {
            grades[subjectId] = { value: null, adjustment: 0 };
          }
        } else {
          const g = allGrades.find(g => g.student_id === student.id && g.assignment_id === assignment.id);
          if (g && g.grade_value != null) {
            const val = parseFloat(g.grade_value) + (g.adjustment_points || 0);
            grades[subjectId] = { value: val, adjustment: g.adjustment_points || 0 };
            gradeSum += val;
            totalGrades++;
            if (val < 10) failedCount++;
          } else {
            grades[subjectId] = { value: null, adjustment: 0 };
          }
        }
      });

      const average = totalGrades > 0 ? Math.round((gradeSum / totalGrades) * 10) / 10 : null;

      return {
        studentId: student.id,
        documentId: student.document_id || "",
        fullName,
        grades,
        average,
        position: 0,
        failedCount,
      };
    });

    // Sort by document_id
    rows.sort((a, b) => a.documentId.localeCompare(b.documentId, undefined, { numeric: true }));

    // Calculate positions by average (descending)
    const ranked = [...rows].filter(r => r.average !== null).sort((a, b) => (b.average || 0) - (a.average || 0));
    ranked.forEach((r, i) => { r.position = i + 1; });
    rows.forEach(r => {
      const found = ranked.find(rk => rk.studentId === r.studentId);
      if (found) r.position = found.position;
    });

    return { students: rows, assignments: validAssignments };
  }

  function generatePdf(
    doc: jsPDF,
    sectionName: string,
    gradeLevel: string,
    yearRange: string,
    data: { students: StudentRow[]; assignments: any[] },
    addPage: boolean
  ) {
    if (addPage) doc.addPage("a4", "landscape");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let y = 12;

    // Header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(school?.name?.toUpperCase() || "COLEGIO", pageWidth / 2, y, { align: "center" });
    y += 5;

    const momentoLabel = selectedMomento === "definitiva"
      ? "NOTAS DEFINITIVAS"
      : `NOTAS DEL MOMENTO ${selectedMomento}`;
    doc.setFontSize(9);
    doc.text(momentoLabel, pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${GRADE_LABELS[gradeLevel] || gradeLevel} - Sección: ${sectionName}    |    Año Escolar: ${yearRange}`, pageWidth / 2, y, { align: "center" });
    y += 7;

    // Build columns
    const subjects = data.assignments.map(a => ({
      id: a.subject_id,
      name: (a.school_subjects as any)?.abbreviation || (a.school_subjects as any)?.name || "Área",
    }));

    if (subjects.length === 0) {
      // No subjects assigned - show student list with message
      doc.setFontSize(9);
      doc.setTextColor(180, 50, 50);
      doc.text("No hay materias asignadas para esta sección", pageWidth / 2, y, { align: "center" });
      y += 6;
      doc.setTextColor(0);

      const head = ["N°", "Cédula", "Apellidos y Nombres"];
      const body = data.students.map((row, idx) => [
        String(idx + 1),
        row.documentId,
        row.fullName,
      ]);

      autoTable(doc, {
        head: [head],
        body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [41, 128, 185], fontSize: 7, halign: "center" },
        bodyStyles: { halign: "center" },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 30 },
          2: { cellWidth: 80, halign: "left" },
        },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          doc.setFontSize(6);
          doc.setTextColor(130);
          doc.text(
            `Generado: ${new Date().toLocaleDateString("es-VE")}`,
            pageWidth / 2, pageH - 6, { align: "center" }
          );
        },
      });
      return;
    }

    const head = ["N°", "Cédula", "Apellidos y Nombres", ...subjects.map(s => s.name), "Prom", "Pos", "Aplaz"];
    const body = data.students.map((row, idx) => {
      const subjectCells = subjects.map(s => {
        const g = row.grades[s.id];
        if (!g || g.value === null) return "";
        const val = g.value % 1 === 0 ? g.value.toFixed(0) : g.value.toFixed(1);
        return g.adjustment !== 0 ? `${val}*` : val;
      });
      return [
        String(idx + 1),
        row.documentId,
        row.fullName,
        ...subjectCells,
        row.average !== null ? row.average.toFixed(1) : "",
        row.position > 0 ? String(row.position) : "",
        String(row.failedCount),
      ];
    });

    // Averages row
    const avgRow = ["", "", "PROMEDIOS"];
    subjects.forEach(s => {
      const vals = data.students.map(r => r.grades[s.id]?.value).filter(v => v !== null) as number[];
      if (vals.length > 0) {
        avgRow.push((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
      } else {
        avgRow.push("");
      }
    });
    const allAvgs = data.students.map(r => r.average).filter(v => v !== null) as number[];
    avgRow.push(allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1) : "");
    avgRow.push("");
    avgRow.push("");
    body.push(avgRow);

    const colWidths: Record<number, { cellWidth: number }> = {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 45 },
    };
    const lastIdx = 3 + subjects.length;
    colWidths[lastIdx] = { cellWidth: 12 };
    colWidths[lastIdx + 1] = { cellWidth: 10 };
    colWidths[lastIdx + 2] = { cellWidth: 12 };

    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 6, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [41, 128, 185], fontSize: 6, halign: "center" },
      bodyStyles: { halign: "center" },
      columnStyles: {
        ...colWidths,
        2: { cellWidth: 45, halign: "left" },
      },
      didParseCell: (hookData) => {
        if (hookData.row.index === body.length - 1 && hookData.section === "body") {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [230, 240, 250];
        }
        if (hookData.section === "body" && hookData.row.index < body.length - 1) {
          const colIdx = hookData.column.index;
          if (colIdx >= 3 && colIdx < 3 + subjects.length) {
            const cellText = hookData.cell.raw as string;
            const numVal = parseFloat(cellText?.replace("*", "") || "");
            if (!isNaN(numVal) && numVal < 10) {
              hookData.cell.styles.textColor = [220, 50, 50];
            }
            if (cellText?.includes("*")) {
              hookData.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
      didDrawPage: () => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(6);
        doc.setTextColor(130);
        doc.text(
          `* Indica ajuste de nota   |   Generado: ${new Date().toLocaleDateString("es-VE")}`,
          pageWidth / 2, pageH - 6, { align: "center" }
        );
      },
    });
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
      const year = schoolYears?.find(y => y.id === selectedYearId);
      generatePdf(doc, section.name, section.grade_level, year?.year_range || "", data, false);

      const momentoLabel = selectedMomento === "definitiva" ? "Definitiva" : `Momento${selectedMomento}`;
      doc.save(`Sabana_${GRADE_LABELS[section.grade_level]}_${section.name}_${momentoLabel}.pdf`);
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
      const year = schoolYears?.find(y => y.id === selectedYearId);
      let first = true;

      for (const section of sectionsData) {
        const data = await fetchSectionData(section.id, section.studentIds);
        if (!data) continue;
        generatePdf(doc, section.name, section.grade_level, year?.year_range || "", data, !first);
        first = false;
      }

      if (first) {
        toast.error("No se encontraron datos para generar");
        return;
      }

      const momentoLabel = selectedMomento === "definitiva" ? "Definitiva" : `Momento${selectedMomento}`;
      doc.save(`Sabana_Todas_Secciones_${momentoLabel}.pdf`);
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

        <Tabs defaultValue="sabana" className="w-full">
          <TabsList>
            <TabsTrigger value="sabana">Sábana de Notas</TabsTrigger>
            <TabsTrigger value="boletin" disabled>Boletín Informativo</TabsTrigger>
            <TabsTrigger value="resumen" disabled>Resumen Académico</TabsTrigger>
          </TabsList>

          <TabsContent value="sabana" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Año Escolar</label>
                    <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                      <SelectTrigger className="w-48">
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
                    <label className="text-sm font-medium">Momento</label>
                    <Select value={selectedMomento} onValueChange={setSelectedMomento}>
                      <SelectTrigger className="w-48">
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

                  {sectionsData && sectionsData.length > 0 && (
                    <Button
                      onClick={handleDownloadAll}
                      disabled={downloading === "all"}
                      className="ml-auto"
                    >
                      {downloading === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Descargar Todas
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {sectionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !sectionsData?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No hay secciones de secundaria con alumnos inscritos para el año escolar seleccionado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sectionsData.map(section => (
                  <Card key={section.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">
                          {GRADE_LABELS[section.grade_level] || section.grade_level} - {section.name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Users className="h-3 w-3" />
                          {section.studentCount} estudiantes
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadSection(section)}
                        disabled={downloading === section.id}
                      >
                        {downloading === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="boletin" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Construction className="h-8 w-8" />
                <p>Próximamente: Boletín Informativo</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resumen" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Construction className="h-8 w-8" />
                <p>Próximamente: Resumen Académico</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
