import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ExportColumn {
  key: string;
  label: string;
}

type RecordRow = Record<string, any>;

function sanitize(val: any): string {
  if (val == null || val === "—") return "";
  return String(val);
}

// ── CSV ──────────────────────────────────────────────
export function downloadCSV(
  columns: ExportColumn[],
  rows: RecordRow[],
  filename: string
) {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(sanitize(r[c.key]))).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + header + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${filename}.csv`);
}

// ── Excel ────────────────────────────────────────────
export function downloadExcel(
  columns: ExportColumn[],
  rows: RecordRow[],
  filename: string
) {
  const data = rows.map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((c) => {
      obj[c.label] = sanitize(r[c.key]);
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF ──────────────────────────────────────────────
export function downloadPDF(
  columns: ExportColumn[],
  rows: RecordRow[],
  filename: string
) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });

  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => sanitize(r[c.key]))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185] },
    margin: { top: 15 },
    didDrawPage: (data) => {
      doc.setFontSize(12);
      doc.text(filename, data.settings.margin.left, 10);
    },
  });

  doc.save(`${filename}.pdf`);
}

// ── Helper ───────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
