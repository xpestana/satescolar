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
import { Loader2, Download, FileText, Users, Info, Hammer } from "lucide-react";
import { DocumentBuilder } from "@/components/utilities/DocumentBuilder";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addArialFont } from "@/lib/pdf-fonts";

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
  /** Per-momento detail for definitiva mode */
  momentoDetail: Record<string, { m1: number | null; m2: number | null; m3: number | null; adj1: number; adj2: number; adj3: number; avg: number | null }>;
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
      const momentoDetail: Record<string, { m1: number | null; m2: number | null; m3: number | null; adj1: number; adj2: number; adj3: number; avg: number | null }> = {};
      let totalGrades = 0;
      let gradeSum = 0;
      let failedCount = 0;

      validAssignments.forEach(assignment => {
        const subjectId = assignment.subject_id;
        const isGcrp = !regularAssignmentIds.has(assignment.id);

        // Skip GCRP assignments for students not enrolled in them
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
              const raw = parseFloat(g.grade_value || "0");
              const adj = g.adjustment_points || 0;
              const val = raw + adj;
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
            gradeSum += avg;
            totalGrades++;
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
            gradeSum += val;
            totalGrades++;
            if (val < 10) failedCount++;
          } else {
            grades[subjectId] = { value: null, adjustment: 0 };
          }
          momentoDetail[subjectId] = { m1: null, m2: null, m3: null, adj1: 0, adj2: 0, adj3: 0, avg: null };
        }
      });

      const average = totalGrades > 0 ? Math.round((gradeSum / totalGrades) * 10) / 10 : null;

      return {
        studentId: student.id,
        documentId: student.document_id || "",
        fullName,
        grades,
        momentoDetail,
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

    // Print date/time
    const now = new Date();
    const printDate = now.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const printTime = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
    doc.setFontSize(6);
    doc.setFont("Arial", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(`Impreso: ${printDate} ${printTime}`, pageWidth - margin, 7, { align: "right" });

    // Header
    doc.setFontSize(10);
    doc.setFont("Arial", "bold");
    doc.setTextColor(0);
    doc.text(school?.name?.toUpperCase() || "COLEGIO", pageWidth / 2, y, { align: "center" });
    y += 5;

    const momentoLabel = selectedMomento === "definitiva"
      ? "NOTAS DEFINITIVAS"
      : `NOTAS DEL MOMENTO ${selectedMomento}`;
    doc.setFontSize(10);
    doc.text(momentoLabel, pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont("Arial", "normal");
    doc.setFontSize(10);
    doc.text(`${GRADE_LABELS[gradeLevel] || gradeLevel} - Sección: ${sectionName}    |    Año Escolar: ${yearRange}`, pageWidth / 2, y, { align: "center" });
    y += 7;

    // Build columns
    const subjects = data.assignments.map(a => ({
      id: a.subject_id,
      name: (a.school_subjects as any)?.abbreviation || (a.school_subjects as any)?.name || "Área",
    }));

    if (subjects.length === 0) {
      // No subjects assigned - show student list with message
      doc.setFontSize(10);
      doc.setFont("Arial", "normal");
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
        styles: { fontSize: 10, font: "Arial", cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [41, 128, 185], fontSize: 10, halign: "center" },
        bodyStyles: { halign: "center" },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 30 },
          2: { cellWidth: 80, halign: "left" },
        },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(130);
          doc.text(
            `Generado: ${new Date().toLocaleDateString("es-VE")}`,
            pageWidth / 2, pageH - 6, { align: "center" }
          );
        },
      });
      return;
    }

    const isDefinitiva = selectedMomento === "definitiva";

    if (isDefinitiva) {
      // ──── DEFINITIVA MODE: 4 sub-columns per subject (1, 2, 3, D) ────
      // Two-row header
      const headerRow1: any[] = [
        { content: "N°", rowSpan: 2 },
        { content: "Cédula", rowSpan: 2 },
        { content: "Apellidos y Nombres", rowSpan: 2 },
      ];
      subjects.forEach(s => {
        headerRow1.push({ content: s.name, colSpan: 4 });
      });
      headerRow1.push({ content: "Prom", rowSpan: 2 });
      headerRow1.push({ content: "Pos", rowSpan: 2 });
      headerRow1.push({ content: "Aplaz", rowSpan: 2 });

      const headerRow2: any[] = [];
      subjects.forEach(() => {
        headerRow2.push("1", "2", "3", "D");
      });

      // Body
      const body: string[][] = data.students.map((row, idx) => {
        const cells: string[] = [String(idx + 1), row.documentId, row.fullName];
        subjects.forEach(s => {
          const d = row.momentoDetail[s.id];
          const fmt = (v: number | null) => {
            if (v === null) return "";
            return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
          };
          cells.push(fmt(d?.m1 ?? null), fmt(d?.m2 ?? null), fmt(d?.m3 ?? null), fmt(d?.avg ?? null));
        });
        cells.push(row.average !== null ? row.average.toFixed(1) : "");
        cells.push(row.position > 0 ? String(row.position) : "");
        cells.push(String(row.failedCount));
        return cells;
      });

      // Averages row
      const avgRow: string[] = ["", "", "PROMEDIOS"];
      subjects.forEach(s => {
        [1, 2, 3].forEach(m => {
          const key = `m${m}` as "m1" | "m2" | "m3";
          const vals = data.students.map(r => r.momentoDetail[s.id]?.[key]).filter(v => v !== null) as number[];
          avgRow.push(vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "");
        });
        const dVals = data.students.map(r => r.momentoDetail[s.id]?.avg).filter(v => v !== null) as number[];
        avgRow.push(dVals.length > 0 ? (dVals.reduce((a, b) => a + b, 0) / dVals.length).toFixed(1) : "");
      });
      const allAvgs = data.students.map(r => r.average).filter(v => v !== null) as number[];
      avgRow.push(allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1) : "");
      avgRow.push(""); avgRow.push("");
      body.push(avgRow);

      // Build adjustment lookup: key = "rowIdx-subjectIdx-momento(0-2)" => adj value
      const adjMap: Record<string, number> = {};
      data.students.forEach((row, rowIdx) => {
        subjects.forEach((s, sIdx) => {
          const d = row.momentoDetail[s.id];
          if (d) {
            if (d.adj1 !== 0) adjMap[`${rowIdx}-${sIdx}-0`] = d.adj1;
            if (d.adj2 !== 0) adjMap[`${rowIdx}-${sIdx}-1`] = d.adj2;
            if (d.adj3 !== 0) adjMap[`${rowIdx}-${sIdx}-2`] = d.adj3;
          }
        });
      });

      const totalSubCols = subjects.length * 4;
      const colStyles: Record<number, any> = {
        0: { cellWidth: 7 },
        1: { cellWidth: 18 },
        2: { cellWidth: 38, halign: "left" },
      };
      // Subject sub-columns
      for (let i = 0; i < totalSubCols; i++) {
        colStyles[3 + i] = { cellWidth: "auto" };
      }
      const lastBase = 3 + totalSubCols;
      colStyles[lastBase] = { cellWidth: 10 };
      colStyles[lastBase + 1] = { cellWidth: 8 };
      colStyles[lastBase + 2] = { cellWidth: 10 };

      autoTable(doc, {
        head: [headerRow1, headerRow2],
        body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, font: "Arial", cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [41, 128, 185], fontSize: 7, halign: "center", cellPadding: 1 },
        bodyStyles: { halign: "center" },
        columnStyles: colStyles,
        didParseCell: (hookData) => {
          if (hookData.row.index === body.length - 1 && hookData.section === "body") {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [230, 240, 250];
          }
          // Red text for failing grades (< 10)
          if (hookData.section === "body" && hookData.row.index < body.length - 1) {
            const colIdx = hookData.column.index;
            if (colIdx >= 3 && colIdx < 3 + totalSubCols) {
              const cellText = hookData.cell.raw as string;
              const numVal = parseFloat(cellText || "");
              if (!isNaN(numVal) && numVal < 10) {
                hookData.cell.styles.textColor = [220, 50, 50];
              }
            }
          }
          // "D" columns bold
          if (hookData.section === "body" && hookData.row.index < body.length - 1) {
            const colIdx = hookData.column.index;
            if (colIdx >= 3 && colIdx < 3 + totalSubCols) {
              const relIdx = (colIdx - 3) % 4;
              if (relIdx === 3) {
                hookData.cell.styles.fontStyle = "bold";
              }
            }
          }
        },
        didDrawCell: (hookData) => {
          // Draw adjustment indicator in red at bottom-right of momento cells (1,2,3)
          if (hookData.section === "body" && hookData.row.index < body.length - 1) {
            const colIdx = hookData.column.index;
            if (colIdx >= 3 && colIdx < 3 + totalSubCols) {
              const relIdx = (colIdx - 3) % 4; // 0=m1, 1=m2, 2=m3, 3=D
              if (relIdx < 3) {
                const sIdx = Math.floor((colIdx - 3) / 4);
                const adj = adjMap[`${hookData.row.index}-${sIdx}-${relIdx}`];
                if (adj) {
                  const cell = hookData.cell;
                  const label = adj > 0 ? `+${adj}` : String(adj);
                  doc.setFontSize(5);
                  doc.setFont("Arial", "bold");
                  doc.setTextColor(220, 50, 50);
                  doc.text(label, cell.x + cell.width - 0.5, cell.y + cell.height - 0.5, { align: "right" });
                }
              }
            }
          }
        },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          doc.setFontSize(7);
          doc.setTextColor(130);
          doc.text(
            `Números en rojo (esquina) = Puntos de ajuste  |  D = Definitiva (promedio de los 3 momentos)`,
            pageWidth / 2, pageH - 6, { align: "center" }
          );
        },
      });
    } else {
      // ──── SINGLE MOMENTO MODE ────
      const adjustmentMap: Record<string, number> = {};
      data.students.forEach((row, rowIdx) => {
        subjects.forEach((s, sIdx) => {
          const g = row.grades[s.id];
          if (g && g.adjustment !== 0) {
            adjustmentMap[`${rowIdx}-${sIdx}`] = g.adjustment;
          }
        });
      });

      const head = ["N°", "Cédula", "Apellidos y Nombres", ...subjects.map(s => s.name), "Prom", "Pos", "Aplaz"];
      const body = data.students.map((row, idx) => {
        const subjectCells = subjects.map(s => {
          const g = row.grades[s.id];
          if (!g || g.value === null) return "";
          return g.value % 1 === 0 ? g.value.toFixed(0) : g.value.toFixed(1);
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
        avgRow.push(vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "");
      });
      const allAvgs = data.students.map(r => r.average).filter(v => v !== null) as number[];
      avgRow.push(allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1) : "");
      avgRow.push(""); avgRow.push("");
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
        styles: { fontSize: 10, font: "Arial", cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [41, 128, 185], fontSize: 10, halign: "center" },
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
              const numVal = parseFloat(cellText || "");
              if (!isNaN(numVal) && numVal < 10) {
                hookData.cell.styles.textColor = [220, 50, 50];
              }
            }
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section === "body" && hookData.row.index < body.length - 1) {
            const colIdx = hookData.column.index;
            if (colIdx >= 3 && colIdx < 3 + subjects.length) {
              const sIdx = colIdx - 3;
              const adj = adjustmentMap[`${hookData.row.index}-${sIdx}`];
              if (adj) {
                const cell = hookData.cell;
                const label = adj > 0 ? `+${adj}` : String(adj);
                doc.setFontSize(6);
                doc.setFont("Arial", "bold");
                doc.setTextColor(220, 50, 50);
                doc.text(label, cell.x + cell.width - 1.5, cell.y + cell.height - 1, { align: "right" });
              }
            }
          }
        },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(130);
          doc.text(
            `Números en rojo (esquina) = Puntos de ajuste`,
            pageWidth / 2, pageH - 6, { align: "center" }
          );
        },
      });
    }
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
      generatePdf(doc, section.name, section.grade_level, year?.year_range || "", data, false);

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
        generatePdf(doc, section.name, section.grade_level, year?.year_range || "", data, !first);
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
          </TabsList>

          <TabsContent value="constructor" className="mt-4">
            <DocumentBuilder />
          </TabsContent>

          <TabsContent value="sabana" className="space-y-4 mt-4">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border/50">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">¿Cómo usar la Sábana de Notas?</span></p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>Selecciona el <strong>Año Escolar</strong> y el <strong>Momento</strong> que deseas consultar (1, 2, 3 o Definitiva Anual).</li>
                  <li>Aparecerán las secciones de secundaria con alumnos inscritos.</li>
                  <li>Haz clic en el ícono de descarga <Download className="h-3.5 w-3.5 inline-block align-text-bottom" /> de cada sección para obtener su PDF individual.</li>
                  <li>Usa el botón <strong>"Descargar Todas"</strong> para generar un único PDF con todas las secciones.</li>
                </ol>
                <p className="text-xs text-muted-foreground/80 mt-1">En la Definitiva Anual, el PDF muestra las notas de los 3 momentos junto al promedio por materia.</p>
              </div>
            </div>
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
              <div className="space-y-3 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
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

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
