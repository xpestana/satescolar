import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SabanaDisplayConfig, hexToRgb } from "@/hooks/useSabanaConfig";

export interface StudentRow {
  studentId: string;
  documentId: string;
  fullName: string;
  grades: Record<string, { value: number | null; adjustment: number }>;
  momentoDetail: Record<string, {
    m1: number | null; m2: number | null; m3: number | null;
    adj1: number; adj2: number; adj3: number; avg: number | null;
  }>;
  average: number | null;
  position: number;
  failedCount: number;
}

export const SECONDARY_GRADES = [
  "1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano",
] as const;

export const GRADE_LABELS: Record<string, string> = {
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", "6_ano": "6to Año",
};

export function generateSabanaPdf(
  doc: jsPDF,
  sectionName: string,
  gradeLevel: string,
  yearRange: string,
  data: { students: StudentRow[]; assignments: any[] },
  addPage: boolean,
  momento: string,
  schoolName: string,
  config: SabanaDisplayConfig
) {
  if (addPage) doc.addPage("a4", "landscape");

  const pageWidth = doc.internal.pageSize.getWidth();
  const { marginX, marginY, tableFontSize, headerFontSize } = config;
  const headerRgb = hexToRgb(config.headerColor);
  let y = marginY;

  // Timestamp
  const now = new Date();
  const printDate = now.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const printTime = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
  doc.setFontSize(6);
  doc.setFont("Arial", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(`Impreso: ${printDate} ${printTime}`, pageWidth - marginX, 7, { align: "right" });

  // Document header
  doc.setFontSize(10);
  doc.setFont("Arial", "bold");
  doc.setTextColor(0);
  doc.text(schoolName.toUpperCase() || "COLEGIO", pageWidth / 2, y, { align: "center" });
  y += 5;

  const momentoLabel = momento === "definitiva"
    ? "NOTAS DEFINITIVAS"
    : `NOTAS DEL MOMENTO ${momento}`;
  doc.setFontSize(10);
  doc.text(momentoLabel, pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFont("Arial", "normal");
  doc.setFontSize(10);
  doc.text(
    `${GRADE_LABELS[gradeLevel] || gradeLevel} - Sección: ${sectionName}    |    Año Escolar: ${yearRange}`,
    pageWidth / 2, y, { align: "center" }
  );
  y += 7;

  const subjects = data.assignments.map(a => ({
    id: a.subject_id,
    name: (a.school_subjects as any)?.abbreviation || (a.school_subjects as any)?.name || "Área",
  }));

  if (subjects.length === 0) {
    doc.setFontSize(tableFontSize);
    doc.setFont("Arial", "normal");
    doc.setTextColor(180, 50, 50);
    doc.text("No hay materias asignadas para esta sección", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setTextColor(0);

    autoTable(doc, {
      head: [["N°", "Cédula", "Apellidos y Nombres"]],
      body: data.students.map((row, idx) => [String(idx + 1), row.documentId, row.fullName]),
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: tableFontSize, font: "Arial", cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: headerRgb, fontSize: headerFontSize, halign: "center" },
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
        doc.text(`Generado: ${new Date().toLocaleDateString("es-VE")}`, pageWidth / 2, pageH - 6, { align: "center" });
      },
    });
    return;
  }

  if (momento === "definitiva") {
    const headerRow1: any[] = [
      { content: "N°", rowSpan: 2 },
      { content: "Cédula", rowSpan: 2 },
      { content: "Apellidos y Nombres", rowSpan: 2 },
    ];
    subjects.forEach(s => headerRow1.push({ content: s.name, colSpan: 4 }));
    headerRow1.push({ content: "Prom", rowSpan: 2 });
    headerRow1.push({ content: "Pos", rowSpan: 2 });
    headerRow1.push({ content: "Aplaz", rowSpan: 2 });

    const headerRow2: any[] = [];
    subjects.forEach(() => headerRow2.push("1", "2", "3", "D"));

    const body: string[][] = data.students.map((row, idx) => {
      const cells: string[] = [String(idx + 1), row.documentId, row.fullName];
      subjects.forEach(s => {
        const d = row.momentoDetail[s.id];
        const fmt = (v: number | null) => v === null ? "" : v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
        cells.push(fmt(d?.m1 ?? null), fmt(d?.m2 ?? null), fmt(d?.m3 ?? null), fmt(d?.avg ?? null));
      });
      cells.push(row.average !== null ? row.average.toFixed(1) : "");
      cells.push(row.position > 0 ? String(row.position) : "");
      cells.push(String(row.failedCount));
      return cells;
    });

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
    for (let i = 0; i < totalSubCols; i++) colStyles[3 + i] = { cellWidth: "auto" };
    const lastBase = 3 + totalSubCols;
    colStyles[lastBase] = { cellWidth: 10 };
    colStyles[lastBase + 1] = { cellWidth: 8 };
    colStyles[lastBase + 2] = { cellWidth: 10 };

    autoTable(doc, {
      head: [headerRow1, headerRow2],
      body,
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: tableFontSize, font: "Arial", cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: headerRgb, fontSize: headerFontSize, halign: "center", cellPadding: 1 },
      bodyStyles: { halign: "center" },
      columnStyles: colStyles,
      didParseCell: (hookData) => {
        if (hookData.row.index === body.length - 1 && hookData.section === "body") {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [230, 240, 250];
        }
        if (hookData.section === "body" && hookData.row.index < body.length - 1) {
          const colIdx = hookData.column.index;
          if (colIdx >= 3 && colIdx < 3 + totalSubCols) {
            const numVal = parseFloat(hookData.cell.raw as string || "");
            if (!isNaN(numVal) && numVal < 10) hookData.cell.styles.textColor = [220, 50, 50];
          }
          if (colIdx >= 3 && colIdx < 3 + totalSubCols) {
            if ((colIdx - 3) % 4 === 3) hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawCell: (hookData) => {
        if (hookData.section === "body" && hookData.row.index < body.length - 1) {
          const colIdx = hookData.column.index;
          if (colIdx >= 3 && colIdx < 3 + totalSubCols) {
            const relIdx = (colIdx - 3) % 4;
            if (relIdx < 3) {
              const sIdx = Math.floor((colIdx - 3) / 4);
              const adj = adjMap[`${hookData.row.index}-${sIdx}-${relIdx}`];
              if (adj) {
                const cell = hookData.cell;
                doc.setFontSize(5);
                doc.setFont("Arial", "bold");
                doc.setTextColor(220, 50, 50);
                doc.text(adj > 0 ? `+${adj}` : String(adj), cell.x + cell.width - 0.5, cell.y + cell.height - 0.5, { align: "right" });
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
    // Single momento mode
    const adjustmentMap: Record<string, number> = {};
    data.students.forEach((row, rowIdx) => {
      subjects.forEach((s, sIdx) => {
        const g = row.grades[s.id];
        if (g && g.adjustment !== 0) adjustmentMap[`${rowIdx}-${sIdx}`] = g.adjustment;
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
        String(idx + 1), row.documentId, row.fullName,
        ...subjectCells,
        row.average !== null ? row.average.toFixed(1) : "",
        row.position > 0 ? String(row.position) : "",
        String(row.failedCount),
      ];
    });

    const avgRow = ["", "", "PROMEDIOS"];
    subjects.forEach(s => {
      const vals = data.students.map(r => r.grades[s.id]?.value).filter(v => v !== null) as number[];
      avgRow.push(vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "");
    });
    const allAvgs = data.students.map(r => r.average).filter(v => v !== null) as number[];
    avgRow.push(allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1) : "");
    avgRow.push(""); avgRow.push("");
    body.push(avgRow);

    const colWidths: Record<number, { cellWidth: number | string; halign?: string }> = {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 45, halign: "left" },
    };
    const lastIdx = 3 + subjects.length;
    colWidths[lastIdx] = { cellWidth: 12 };
    colWidths[lastIdx + 1] = { cellWidth: 10 };
    colWidths[lastIdx + 2] = { cellWidth: 12 };

    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: tableFontSize, font: "Arial", cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: headerRgb, fontSize: headerFontSize, halign: "center" },
      bodyStyles: { halign: "center" },
      columnStyles: colWidths as any,
      didParseCell: (hookData) => {
        if (hookData.row.index === body.length - 1 && hookData.section === "body") {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [230, 240, 250];
        }
        if (hookData.section === "body" && hookData.row.index < body.length - 1) {
          const colIdx = hookData.column.index;
          if (colIdx >= 3 && colIdx < 3 + subjects.length) {
            const numVal = parseFloat(hookData.cell.raw as string || "");
            if (!isNaN(numVal) && numVal < 10) hookData.cell.styles.textColor = [220, 50, 50];
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
              doc.setFontSize(6);
              doc.setFont("Arial", "bold");
              doc.setTextColor(220, 50, 50);
              doc.text(adj > 0 ? `+${adj}` : String(adj), cell.x + cell.width - 1.5, cell.y + cell.height - 1, { align: "right" });
            }
          }
        }
      },
      didDrawPage: () => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text(`Números en rojo (esquina) = Puntos de ajuste`, pageWidth / 2, pageH - 6, { align: "center" });
      },
    });
  }
}
