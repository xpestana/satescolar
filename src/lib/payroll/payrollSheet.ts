// The payroll sheet schools hand to their accountant: one row per worker with salary in dollars,
// rate, salary in bolívares, each contribution, ISLR, total discounted, total paid and reference.
// One sheet per category ("Nómina obrero", "Nómina docente"...). The row-building is pure and
// tested; writing the workbook is a thin wrapper over xlsx.

import * as XLSX from "xlsx";
import { round2 } from "./calculateNet";
import { CATEGORY_LABELS, type ConceptKind, type PayrollCategory, type PayrollCurrency, type PayrollPaymentStatus } from "./types";
import type { ContributionKind } from "./contributions/types";

export interface SheetPaymentInput {
  status: PayrollPaymentStatus;
  currency: PayrollCurrency;
  exchange_rate: number;
  payment_reference: string | null;
  beneficiary: {
    full_name: string;
    document_id: string | null;
    hire_date: string | null;
    job_title: string | null;
    category: PayrollCategory;
  };
  items: {
    concept_kind: ConceptKind;
    amount: number;
    amount_ves: number | null;
    withholding_id: string | null;
    contribution_kind: ContributionKind | null;
  }[];
}

export interface SheetRow {
  category: PayrollCategory;
  name: string;
  documentId: string;
  hireDate: string;
  jobTitle: string;
  /** Only for payments in dollars. */
  salaryUsd: number | null;
  rate: number | null;
  grossVes: number;
  ivss: number;
  faov: number;
  rpe: number;
  islr: number;
  otherDeductions: number;
  totalDeductions: number;
  netVes: number;
  reference: string;
}

const ddmmyyyy = (iso: string | null | undefined) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/** One row per live payment, in bolívares as each line was saved. Voided payments are left out. */
export function buildPayrollSheetRows(payments: SheetPaymentInput[]): SheetRow[] {
  return payments
    .filter((p) => p.status !== "voided")
    .map((p) => {
      const rate = Number(p.exchange_rate) || 0;
      const isUsd = p.currency === "USD";
      const ves = (item: SheetPaymentInput["items"][number]) =>
        item.amount_ves != null ? Number(item.amount_ves) : round2((Number(item.amount) || 0) * (isUsd ? rate : 1));
      const sum = (items: SheetPaymentInput["items"]) => round2(items.reduce((s, i) => s + ves(i), 0));

      const earnings = p.items.filter((i) => i.concept_kind === "earning");
      const deductions = p.items.filter((i) => i.concept_kind === "deduction");
      const byKind = (kind: ContributionKind) => sum(deductions.filter((i) => i.contribution_kind === kind));
      const grossVes = sum(earnings);
      const totalDeductions = sum(deductions);
      const ivss = byKind("ivss");
      const faov = byKind("faov");
      const rpe = byKind("rpe");
      const islr = sum(deductions.filter((i) => i.withholding_id));

      return {
        category: p.beneficiary.category,
        name: p.beneficiary.full_name,
        documentId: p.beneficiary.document_id ?? "",
        hireDate: ddmmyyyy(p.beneficiary.hire_date),
        jobTitle: p.beneficiary.job_title ?? "",
        salaryUsd: isUsd ? round2(earnings.reduce((s, i) => s + (Number(i.amount) || 0), 0)) : null,
        rate: isUsd ? rate : null,
        grossVes,
        ivss,
        faov,
        rpe,
        islr,
        otherDeductions: Math.max(0, round2(totalDeductions - ivss - faov - rpe - islr)),
        totalDeductions,
        netVes: round2(grossVes - totalDeductions),
        reference: p.payment_reference?.trim() ?? "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export const PAYROLL_SHEET_HEADER = [
  "Nombres y Apellidos",
  "Cédula",
  "Fecha de ingreso",
  "Cargo",
  "Salario mensual ($)",
  "Tasa",
  "Total sueldo mensual Bs.",
  "IVSS",
  "FAOV",
  "R.P.E. (paro forzoso)",
  "Retención ISLR",
  "Otros descuentos",
  "Total descuento",
  "Total a pagar",
  "Referencia",
];

type Cell = string | number | null;

export interface SheetHeading {
  schoolName: string;
  schoolRif: string | null;
  periodName: string;
  periodStart: string;
  periodEnd: string;
}

/** One sheet as rows of cells: heading, column titles, one row per worker and a totals row over all of them. */
export function buildPayrollSheetAoa(heading: SheetHeading, category: PayrollCategory, rows: SheetRow[]): Cell[][] {
  const total = (pick: (r: SheetRow) => number | null) => round2(rows.reduce((s, r) => s + (pick(r) ?? 0), 0));
  const anyUsd = rows.some((r) => r.salaryUsd !== null);
  return [
    [heading.schoolName],
    [heading.schoolRif ? `RIF ${heading.schoolRif}` : ""],
    [heading.periodName.toUpperCase()],
    [`DEL ${ddmmyyyy(heading.periodStart)} AL ${ddmmyyyy(heading.periodEnd)}`],
    [`NÓMINA ${CATEGORY_LABELS[category].toUpperCase()}`],
    [],
    PAYROLL_SHEET_HEADER,
    ...rows.map((r): Cell[] => [
      r.name,
      r.documentId,
      r.hireDate,
      r.jobTitle,
      r.salaryUsd,
      r.rate,
      r.grossVes,
      r.ivss,
      r.faov,
      r.rpe,
      r.islr,
      r.otherDeductions,
      r.totalDeductions,
      r.netVes,
      r.reference,
    ]),
    [
      "TOTALES",
      "",
      "",
      "",
      anyUsd ? total((r) => r.salaryUsd) : null,
      null,
      total((r) => r.grossVes),
      total((r) => r.ivss),
      total((r) => r.faov),
      total((r) => r.rpe),
      total((r) => r.islr),
      total((r) => r.otherDeductions),
      total((r) => r.totalDeductions),
      total((r) => r.netVes),
      "",
    ],
  ];
}

/** Categories in the usual order, only those with rows. */
export function groupSheetRows(rows: SheetRow[]): [PayrollCategory, SheetRow[]][] {
  return (Object.keys(CATEGORY_LABELS) as PayrollCategory[])
    .map((c): [PayrollCategory, SheetRow[]] => [c, rows.filter((r) => r.category === c)])
    .filter(([, list]) => list.length > 0);
}

export function exportPayrollSheet(heading: SheetHeading, rows: SheetRow[], filename: string): void {
  const workbook = XLSX.utils.book_new();
  for (const [category, list] of groupSheetRows(rows)) {
    const sheet = XLSX.utils.aoa_to_sheet(buildPayrollSheetAoa(heading, category, list));
    sheet["!cols"] = [28, 13, 12, 16, 10, 10, 14, 10, 10, 10, 10, 10, 12, 14, 14].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, `Nómina ${CATEGORY_LABELS[category]}`.slice(0, 31));
  }
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
