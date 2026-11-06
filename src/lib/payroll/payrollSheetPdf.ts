// Printable payroll sheet, laid out like the ones schools already print: period on top, school
// and RIF, one table per category with a row per worker, and totals over every row.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatRate } from "./buildPayrollReceiptData";
import { CATEGORY_LABELS } from "./types";
import { groupSheetRows, type SheetHeading, type SheetRow } from "./payrollSheet";
import { normalizeTaxId } from "./withholdings/taxId";

const amount = (value: number | null) =>
  value === null ? "" : value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const blankZero = (value: number) => (value ? amount(value) : "");
const ddmmyyyy = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** The rate shared by every row in dollars, or null when there is none or they differ. */
function sharedRate(rows: SheetRow[]): number | null {
  const rates = [...new Set(rows.map((r) => r.rate).filter((r): r is number => r !== null))];
  return rates.length === 1 ? rates[0] : null;
}

export function generatePayrollSheetPdf(heading: SheetHeading, rows: SheetRow[]): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const left = 10;
  const rif = heading.schoolRif ? normalizeTaxId(heading.schoolRif) ?? heading.schoolRif : null;

  groupSheetRows(rows).forEach(([category, list], index) => {
    if (index > 0) doc.addPage();
    const rate = sharedRate(list);
    const rateColumn = rate === null && list.some((r) => r.rate !== null);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(heading.periodName.toUpperCase(), 148.5, 13, { align: "center" });
    doc.text(`DEL ${ddmmyyyy(heading.periodStart)} AL ${ddmmyyyy(heading.periodEnd)}`, 148.5, 18.5, { align: "center" });
    doc.setFontSize(10);
    doc.text(heading.schoolName, left, 15);
    doc.setFont("helvetica", "normal");
    if (rif) doc.text(`RIF ${rif}`, left, 20);
    doc.setFont("helvetica", "bold");
    doc.text(`NÓMINA ${CATEGORY_LABELS[category].toUpperCase()}`, left + 20, 29);
    if (rate !== null) doc.text(`DÓLAR     TASA ${formatRate(rate)}`, 200, 29);

    const head = [
      "Nombres y Apellidos",
      "Cédula",
      "Fecha de ingreso",
      "Cargo",
      "Salario mensual ($)",
      ...(rateColumn ? ["Tasa"] : []),
      "Total sueldo mensual Bs.",
      "IVSS",
      "FAOV",
      "R.P.E.",
      "Otros descuentos",
      "Retención ISLR",
      "Total descuento",
      "Total a pagar",
      "Referencia",
    ];
    const body = list.map((r) => [
      r.name,
      r.documentId,
      r.hireDate,
      r.jobTitle,
      r.salaryUsd === null ? "" : r.salaryUsd.toLocaleString("es-VE", { maximumFractionDigits: 2 }),
      ...(rateColumn ? [r.rate === null ? "" : formatRate(r.rate)] : []),
      amount(r.grossVes),
      blankZero(r.ivss),
      blankZero(r.faov),
      blankZero(r.rpe),
      blankZero(r.otherDeductions),
      blankZero(r.islr),
      amount(r.totalDeductions),
      amount(r.netVes),
      r.reference,
    ]);
    const sum = (pick: (r: SheetRow) => number | null) => list.reduce((s, r) => s + (pick(r) ?? 0), 0);
    const anyUsd = list.some((r) => r.salaryUsd !== null);
    const foot = [
      "TOTALES",
      "",
      "",
      "",
      anyUsd ? sum((r) => r.salaryUsd).toLocaleString("es-VE", { maximumFractionDigits: 2 }) : "",
      ...(rateColumn ? [""] : []),
      amount(sum((r) => r.grossVes)),
      amount(sum((r) => r.ivss)),
      amount(sum((r) => r.faov)),
      amount(sum((r) => r.rpe)),
      amount(sum((r) => r.otherDeductions)),
      amount(sum((r) => r.islr)),
      amount(sum((r) => r.totalDeductions)),
      amount(sum((r) => r.netVes)),
      "",
    ];
    const firstAmount = rateColumn ? 6 : 5;

    autoTable(doc, {
      startY: 32,
      head: [head],
      body,
      foot: [foot],
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: "middle" },
      headStyles: { fillColor: [217, 217, 217], textColor: 0, fontStyle: "bold", halign: "center", fontSize: 7 },
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [firstAmount + i, { halign: "right" }])),
      },
      // Column styles only reach the body; the totals line up the same way.
      didParseCell: (cell) => {
        if (cell.section !== "foot") return;
        if (cell.column.index === 4) cell.cell.styles.halign = "center";
        else if (cell.column.index >= firstAmount && cell.column.index < firstAmount + 8) cell.cell.styles.halign = "right";
      },
      margin: { left, right: 10 },
    });
  });

  return doc;
}

export function downloadPayrollSheetPdf(heading: SheetHeading, rows: SheetRow[], filename: string): void {
  generatePayrollSheetPdf(heading, rows).save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
