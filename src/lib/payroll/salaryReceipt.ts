// Salary receipt (Artículo 106 de la LOTTT), shaped like the ones schools already hand out: header
// of the school, a grid with the worker and the period, assignments and deductions side by side in
// bolívares, the net, the signature and observations. Pure: no React, no database.
//
// Each concept can say how it prints with its receipt text: one row per line, "Etiqueta | detalle |
// monto", with variables. Without text, a line prints its name and amount.

import { round2 } from "./calculateNet";
import type { PayrollCategory, PayrollCurrency, PayrollMethodType } from "./types";

export type ContributionKindLabel = "ivss" | "rpe" | "faov";

export interface SalaryReceiptLine {
  concept_kind: "earning" | "deduction";
  description: string | null;
  amount: number;
  amount_ves?: number | null;
  /** Text saved on the payment line (adjusted for that payment). */
  receipt_text?: string | null;
  /** The concept's current text: used by payments saved before lines kept their own. */
  concept_receipt_text?: string | null;
  is_base_salary?: boolean;
  contribution_kind?: ContributionKindLabel | null;
  /** Salary ISLR (AR-I) withheld on this line: its percentage. */
  islr_pct?: number | null;
  unpaid_hours?: number | null;
}

export interface SalaryReceiptInput {
  school: { name: string; address: string | null; rif: string | null; phone: string | null };
  beneficiary: {
    name: string;
    documentId: string | null;
    category: PayrollCategory;
    hireDate: string | null;
    jobTitle: string | null;
  };
  period: { name: string; start: string; end: string; type: "monthly" | "biweekly" };
  method: { type: PayrollMethodType; config: Record<string, unknown> | null } | null;
  currency: PayrollCurrency;
  exchangeRate: number;
  lines: SalaryReceiptLine[];
  notes: string | null;
  /** Whether the school deducts parafiscales / ISLR: their rows show even at 0,00. */
  contributionsEnabled: boolean;
  islrEnabled: boolean;
}

export interface ReceiptRow {
  label: string;
  detail: string;
  amount: string;
}

export interface SalaryReceiptData {
  schoolName: string;
  schoolAddress: string;
  schoolRif: string;
  schoolPhone: string;
  payrollLabel: string;
  workerName: string;
  documentId: string;
  hireDate: string;
  jobTitle: string;
  /** "16.08 AL 31.08.2026" */
  periodRange: string;
  /** "16/08 AL 31/08/2026" */
  periodRangeSlash: string;
  periodName: string;
  bankText: string;
  monthlySalary: string;
  earnings: ReceiptRow[];
  deductions: ReceiptRow[];
  grossVes: string;
  deductionsVes: string;
  netVes: string;
  notes: string;
}

/** 157.515,67 */
export function bs(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const parts = (iso: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? { y: m[1], m: m[2], d: m[3] } : null;
};

export function receiptDate(iso: string | null): string {
  const p = parts(iso);
  return p ? `${p.d}/${p.m}/${p.y}` : "";
}

function range(start: string, end: string, sep: "." | "/"): string {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return "";
  return `${a.d}${sep}${a.m} AL ${b.d}${sep}${b.m}${sep}${b.y}`;
}

function bankText(method: SalaryReceiptInput["method"]): string {
  if (!method) return "";
  const config = method.config ?? {};
  const get = (key: string) => String(config[key] ?? "").trim();
  const bank = get("bank_name");
  switch (method.type) {
    case "transfer": {
      const account = get("account_number");
      return [bank && `BCO. ${bank.replace(/^banco\s+/i, "")}`, account && `CTA N° ${account}`].filter(Boolean).join(" ").toUpperCase();
    }
    case "mobile_payment":
      return ["PAGO MÓVIL", bank, get("phone")].filter(Boolean).join(" ").toUpperCase();
    case "check":
      return ["CHEQUE", bank].filter(Boolean).join(" ").toUpperCase();
    case "cash":
      return "EFECTIVO";
    default:
      return "";
  }
}

/** Replaces {variables} and splits "Etiqueta | detalle | monto" rows. */
export function renderReceiptText(text: string, vars: Record<string, string>): ReceiptRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const filled = line.replace(/\{(\w+)\}/g, (match, name: string) => vars[name.toLowerCase()] ?? match);
      const [label = "", detail = "", amount = ""] = filled.split("|").map((p) => p.trim());
      return { label, detail, amount };
    });
}

export function buildSalaryReceipt(input: SalaryReceiptInput): SalaryReceiptData {
  const isVes = input.currency === "VES";
  const rate = input.exchangeRate > 0 ? input.exchangeRate : 0;
  // Lines saved with their bolívares add up exactly; older lines are converted.
  const lineVes = (l: SalaryReceiptLine) =>
    isVes ? Number(l.amount) || 0 : l.amount_ves != null ? Number(l.amount_ves) : round2((Number(l.amount) || 0) * rate);

  const perMonth = input.period.type === "biweekly" ? 2 : 1;
  const days = input.period.type === "biweekly" ? 15 : 30;
  const earnings = input.lines.filter((l) => l.concept_kind === "earning");
  const deductions = input.lines.filter((l) => l.concept_kind === "deduction");
  const baseLines = earnings.filter((l) => l.is_base_salary);
  const monthly = baseLines.length > 0 ? round2(baseLines.reduce((s, l) => s + lineVes(l), 0) * perMonth) : null;

  const rowsOf = (line: SalaryReceiptLine): ReceiptRow[] => {
    const amount = lineVes(line);
    const text = line.receipt_text?.trim() || line.concept_receipt_text?.trim() || "";
    const name = line.description?.trim() || "Concepto";
    if (!text) return [{ label: name, detail: "", amount: bs(amount) }];
    return renderReceiptText(text, {
      monto: bs(amount),
      dias: String(days),
      valor_dia: monthly != null ? bs(monthly / 30) : "",
      salario_mensual: monthly != null ? bs(monthly) : "",
      horas: line.unpaid_hours ? String(line.unpaid_hours).replace(".", ",") : "",
    });
  };

  // Deductions: the legal ones first, always in the same order, then the school's own.
  const sumOf = (list: SalaryReceiptLine[]) => round2(list.reduce((s, l) => s + lineVes(l), 0));
  const fixed: ReceiptRow[] = [];
  const contribution = (kind: ContributionKindLabel, label: string) => {
    const list = deductions.filter((l) => l.contribution_kind === kind);
    if (input.contributionsEnabled || list.length > 0) fixed.push({ label, detail: "", amount: bs(sumOf(list)) });
  };
  contribution("ivss", "SSO");
  contribution("rpe", "RPE");
  contribution("faov", "FAOV");
  const absences = deductions.filter((l) => l.unpaid_hours);
  const hours = absences.reduce((s, l) => s + (Number(l.unpaid_hours) || 0), 0);
  fixed.push({ label: "FALTAS", detail: hours > 0 ? `${String(hours).replace(".", ",")} h` : "", amount: bs(sumOf(absences)) });
  const islr = deductions.filter((l) => l.islr_pct != null);
  if (input.islrEnabled || islr.length > 0) {
    const pct = islr[0]?.islr_pct;
    fixed.push({
      label: pct != null ? `RETENCIÓN ISLR ${String(pct).replace(".", ",")} %` : "RETENCIÓN ISLR %",
      detail: "",
      amount: bs(sumOf(islr)),
    });
  }
  const others = deductions.filter((l) => !l.contribution_kind && !l.unpaid_hours && l.islr_pct == null);

  const grossVes = sumOf(earnings);
  const deductionsVes = sumOf(deductions);

  return {
    schoolName: input.school.name?.trim() || "—",
    schoolAddress: input.school.address?.trim() || "",
    schoolRif: input.school.rif?.trim() || "",
    schoolPhone: input.school.phone?.trim() || "",
    payrollLabel: input.beneficiary.category === "worker" ? "NÓMINA OBREROS" : "NÓMINA EMPLEADOS",
    workerName: input.beneficiary.name?.trim().toUpperCase() || "—",
    documentId: input.beneficiary.documentId?.trim() || "",
    hireDate: receiptDate(input.beneficiary.hireDate),
    jobTitle: input.beneficiary.jobTitle?.trim() || "",
    periodRange: range(input.period.start, input.period.end, "."),
    periodRangeSlash: range(input.period.start, input.period.end, "/"),
    periodName: input.period.name?.trim().toUpperCase() || "",
    bankText: bankText(input.method),
    monthlySalary: monthly != null ? bs(monthly) : "",
    earnings: earnings.flatMap(rowsOf),
    deductions: [...fixed, ...others.flatMap(rowsOf)],
    grossVes: bs(grossVes),
    deductionsVes: bs(deductionsVes),
    netVes: bs(Math.max(0, round2(grossVes - deductionsVes))),
    notes: input.notes?.trim() || "",
  };
}
