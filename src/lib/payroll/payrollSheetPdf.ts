// Printable payroll sheet, laid out like the ones schools already print: period on top, school
// and RIF, one table per category with a row per worker, and totals over every row. Same columns
// as the Excel sheet.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatRate } from "./buildPayrollReceiptData";
import { CATEGORY_LABELS } from "./types";
import { columnTotal, groupSheetRows, payrollSheetColumns, type SheetHeading, type SheetRow } from "./payrollSheet";
import { normalizeTaxId } from "./withholdings/taxId";

const amount = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = (value: number) => value.toLocaleString("es-VE", { maximumFractionDigits: 4 });
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
    const columns = payrollSheetColumns(list, { rateColumn: rate === null && list.some((r) => r.rate !== null) });

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

    const cell = (value: string | number | null, money: boolean | undefined, title: string) => {
      if (value === null || value === "") return "";
      if (typeof value === "string") return value;
      if (title === "Tasa") return formatRate(value);
      if (!money) return plain(value);
      return value ? amount(value) : "";
    };

    autoTable(doc, {
      startY: 32,
      head: [columns.map((c) => c.title)],
      body: list.map((r) => columns.map((c) => cell(c.value(r), c.money, c.title))),
      foot: [
        columns.map((c, i) => {
          if (i === 0) return "TOTALES";
          const total = columnTotal(c, list);
          return total === null ? "" : c.money ? amount(total) : plain(total);
        }),
      ],
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.2, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: "middle" },
      headStyles: { fillColor: [217, 217, 217], textColor: 0, fontStyle: "bold", halign: "center", fontSize: 6.5 },
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 42 } },
      didParseCell: (data) => {
        const column = columns[data.column.index];
        if (data.section === "head" || !column) return;
        if (column.money) data.cell.styles.halign = "right";
        else if (data.column.index > 0 && column.title !== "Referencia") data.cell.styles.halign = "center";
      },
      margin: { left, right: 10 },
    });
  });

  return doc;
}

export function downloadPayrollSheetPdf(heading: SheetHeading, rows: SheetRow[], filename: string): void {
  generatePayrollSheetPdf(heading, rows).save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
