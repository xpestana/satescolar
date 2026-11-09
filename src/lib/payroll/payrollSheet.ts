// The payroll sheet schools hand to their accountant: one row per worker with base salary in
// dollars, rate, base salary and other earnings (bono, cesta ticket...) in bolívares, each
// contribution, unjustified absences, ISLR, total discounted, total paid and reference.
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
    description?: string | null;
    amount: number;
    amount_ves: number | null;
    withholding_id: string | null;
    contribution_kind: ContributionKind | null;
    unpaid_hours?: number | null;
    concept?: { name: string; is_base_salary: boolean } | null;
  }[];
}

export interface SheetRow {
  category: PayrollCategory;
  name: string;
  documentId: string;
  hireDate: string;
  jobTitle: string;
  /** Base salary in dollars; only for payments in dollars. */
  salaryUsd: number | null;
  rate: number | null;
  /** Base salary in bolívares. */
  baseVes: number;
  /** Other earnings in bolívares, by concept: Bono, Cesta ticket... */
  otherEarnings: Record<string, number>;
  grossVes: number;
  ivss: number;
  faov: number;
  rpe: number;
  unpaidHours: number;
  unpaidHoursVes: number;
  islr: number;
  otherDeductions: number;
  totalDeductions: number;
  netVes: number;
  reference: string;
}

const ddmmyyyy = (iso: string | null | undefined) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

const OTHER_EARNINGS = "Otras asignaciones";

/** One row per live payment, in bolívares as each line was saved. Voided payments are left out. */
export function buildPayrollSheetRows(payments: SheetPaymentInput[]): SheetRow[] {
  return payments
    .filter((p) => p.status !== "voided")
    .map((p) => {
      const rate = Number(p.exchange_rate) || 0;
      const isUsd = p.currency === "USD";
      type Item = SheetPaymentInput["items"][number];
      const ves = (item: Item) =>
        item.amount_ves != null ? Number(item.amount_ves) : round2((Number(item.amount) || 0) * (isUsd ? rate : 1));
      const sum = (items: Item[]) => round2(items.reduce((s, i) => s + ves(i), 0));

      const earnings = p.items.filter((i) => i.concept_kind === "earning");
      const deductions = p.items.filter((i) => i.concept_kind === "deduction");
      // Without a line marked as base salary (older payments), every earning counts as salary.
      const marked = earnings.filter((i) => i.concept?.is_base_salary);
      const base = marked.length > 0 ? marked : earnings;
      const others = earnings.filter((i) => !base.includes(i));
      const otherEarnings: Record<string, number> = {};
      for (const item of others) {
        const key = item.concept?.name?.trim() || OTHER_EARNINGS;
        otherEarnings[key] = round2((otherEarnings[key] ?? 0) + ves(item));
      }

      const byKind = (kind: ContributionKind) => sum(deductions.filter((i) => i.contribution_kind === kind));
      const absences = deductions.filter((i) => i.unpaid_hours);
      const grossVes = sum(earnings);
      const totalDeductions = sum(deductions);
      const ivss = byKind("ivss");
      const faov = byKind("faov");
      const rpe = byKind("rpe");
      const islr = sum(deductions.filter((i) => i.withholding_id));
      const unpaidHoursVes = sum(absences);

      return {
        category: p.beneficiary.category,
        name: p.beneficiary.full_name,
        documentId: p.beneficiary.document_id ?? "",
        hireDate: ddmmyyyy(p.beneficiary.hire_date),
        jobTitle: p.beneficiary.job_title ?? "",
        salaryUsd: isUsd ? round2(base.reduce((s, i) => s + (Number(i.amount) || 0), 0)) : null,
        rate: isUsd ? rate : null,
        baseVes: sum(base),
        otherEarnings,
        grossVes,
        ivss,
        faov,
        rpe,
        unpaidHours: absences.reduce((s, i) => s + (Number(i.unpaid_hours) || 0), 0),
        unpaidHoursVes,
        islr,
        otherDeductions: Math.max(0, round2(totalDeductions - ivss - faov - rpe - islr - unpaidHoursVes)),
        totalDeductions,
        netVes: round2(grossVes - totalDeductions),
        reference: p.payment_reference?.trim() ?? "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Other-earnings columns of a sheet, in the order they first appear. */
export function otherEarningColumns(rows: SheetRow[]): string[] {
  const names: string[] = [];
  for (const row of rows) for (const name of Object.keys(row.otherEarnings)) if (!names.includes(name)) names.push(name);
  return names;
}

export interface SheetColumn {
  title: string;
  /** Money in bolívares: right-aligned and added up in the totals row. */
  money?: boolean;
  value: (row: SheetRow) => string | number | null;
  /** Totals row; money columns add up by default. */
  total?: (rows: SheetRow[]) => number | null;
}

const sumOf = (rows: SheetRow[], pick: (r: SheetRow) => number | null) => round2(rows.reduce((s, r) => s + (pick(r) ?? 0), 0));

/** Columns of one sheet. Extra earnings get a column each, plus a total of earnings. */
export function payrollSheetColumns(rows: SheetRow[], options: { rateColumn: boolean }): SheetColumn[] {
  const others = otherEarningColumns(rows);
  const anyUsd = rows.some((r) => r.salaryUsd !== null);
  const money = (title: string, value: (r: SheetRow) => number): SheetColumn => ({ title, money: true, value });
  return [
    { title: "Nombres y Apellidos", value: (r) => r.name },
    { title: "Cédula", value: (r) => r.documentId },
    { title: "Fecha de ingreso", value: (r) => r.hireDate },
    { title: "Cargo", value: (r) => r.jobTitle },
    { title: "Sueldo mensual ($)", value: (r) => r.salaryUsd, total: (list) => (anyUsd ? sumOf(list, (r) => r.salaryUsd) : null) },
    ...(options.rateColumn ? [{ title: "Tasa", value: (r: SheetRow) => r.rate, total: () => null }] : []),
    money("Total sueldo mensual Bs.", (r) => r.baseVes),
    ...others.map((name) => money(`${name} Bs.`, (r) => r.otherEarnings[name] ?? 0)),
    ...(others.length > 0 ? [money("Total asignaciones Bs.", (r) => r.grossVes)] : []),
    money("IVSS", (r) => r.ivss),
    money("FAOV", (r) => r.faov),
    money("R.P.E. (paro forzoso)", (r) => r.rpe),
    money("Permiso no justificado", (r) => r.unpaidHoursVes),
    money("Retención ISLR", (r) => r.islr),
    money("Otros descuentos", (r) => r.otherDeductions),
    money("Total descuento", (r) => r.totalDeductions),
    money("Total a pagar", (r) => r.netVes),
    { title: "Referencia", value: (r) => r.reference },
  ];
}

export function columnTotal(column: SheetColumn, rows: SheetRow[]): number | null {
  if (column.total) return column.total(rows);
  return column.money ? sumOf(rows, (r) => column.value(r) as number) : null;
}

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
  const columns = payrollSheetColumns(rows, { rateColumn: true });
  return [
    [heading.schoolName],
    [heading.schoolRif ? `RIF ${heading.schoolRif}` : ""],
    [heading.periodName.toUpperCase()],
    [`DEL ${ddmmyyyy(heading.periodStart)} AL ${ddmmyyyy(heading.periodEnd)}`],
    [`NÓMINA ${CATEGORY_LABELS[category].toUpperCase()}`],
    [],
    columns.map((c) => c.title),
    ...rows.map((r): Cell[] => columns.map((c) => c.value(r))),
    columns.map((c, i) => (i === 0 ? "TOTALES" : columnTotal(c, rows) ?? "")),
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
    const aoa = buildPayrollSheetAoa(heading, category, list);
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = aoa[6].map((_, i) => ({ wch: i === 0 ? 30 : 13 }));
    XLSX.utils.book_append_sheet(workbook, sheet, `Nómina ${CATEGORY_LABELS[category]}`.slice(0, 31));
  }
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
