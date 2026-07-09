// Payroll Excel export. The row-building is pure and tested; the actual workbook
// write is a thin wrapper over xlsx (kept out of tests since it touches the DOM).

import * as XLSX from "xlsx";
import { round2 } from "./calculateNet";
import { CATEGORY_LABELS, STATUS_LABELS } from "./types";
import type { PayrollCategory, PayrollPaymentStatus, PayrollCurrency } from "./types";

export interface PayrollExcelRow {
  beneficiaryName: string;
  documentId: string | null;
  category: PayrollCategory;
  periodName: string;
  status: PayrollPaymentStatus;
  currency: PayrollCurrency;
  gross: number;
  deductions: number;
  net: number;
  netVes: number;
  methodLabel: string | null;
  paymentDate: string | null;
}

export const PAYROLL_EXCEL_HEADER = [
  "Beneficiario",
  "Cédula",
  "Categoría",
  "Período",
  "Estado",
  "Moneda",
  "Ingresos",
  "Deducciones",
  "Neto",
  "Neto (VES)",
  "Método",
  "Fecha de pago",
];

type Cell = string | number;

/** Build a sheet as an array-of-arrays: header + one row per payment + a totals row. */
export function buildPayrollExcelRows(rows: PayrollExcelRow[]): Cell[][] {
  const body: Cell[][] = rows.map((r) => [
    r.beneficiaryName || "—",
    r.documentId || "—",
    CATEGORY_LABELS[r.category] ?? r.category,
    r.periodName || "—",
    STATUS_LABELS[r.status] ?? r.status,
    r.currency,
    round2(r.gross),
    round2(r.deductions),
    round2(r.net),
    round2(r.netVes),
    r.methodLabel || "—",
    r.paymentDate || "—",
  ]);

  // Totals only count non-voided payments, summed in VES (the common currency).
  const totalVes = rows
    .filter((r) => r.status !== "voided")
    .reduce((sum, r) => sum + (Number.isFinite(r.netVes) ? r.netVes : 0), 0);

  const totalsRow: Cell[] = ["TOTAL (VES)", "", "", "", "", "", "", "", "", round2(totalVes), "", ""];

  return [PAYROLL_EXCEL_HEADER, ...body, totalsRow];
}

/** Write and trigger download of the payroll Excel file. */
export function exportPayrollExcel(rows: PayrollExcelRow[], filename: string): void {
  const aoa = buildPayrollExcelRows(rows);
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Nómina");
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
