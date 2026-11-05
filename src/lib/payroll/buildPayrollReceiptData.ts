// Pure builder that shapes a payroll payment into the data a receipt (PDF/email) needs.
// No React, no DB — just mapping + formatting so it is fully testable and reusable by
// both the client PDF and the Edge Function email.

import { calculatePayrollTotals, round2 } from "./calculateNet";
import {
  CATEGORY_LABELS,
  METHOD_LABELS,
  type PayrollCurrency,
  type PayrollLineItem,
  type PayrollMethodType,
} from "./types";

export interface PayrollReceiptInput {
  schoolName: string;
  beneficiaryName: string;
  documentId: string | null;
  category: keyof typeof CATEGORY_LABELS;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  currency: PayrollCurrency;
  exchangeRate: number;
  items: PayrollLineItem[];
  methodType: PayrollMethodType | null;
  methodLabel: string | null;
  paymentDate: string | null;
  /** Bank reference given when the payment was marked paid. */
  paymentReference?: string | null;
  notes: string | null;
}

export interface PayrollReceiptLine {
  description: string;
  amountFormatted: string;
  /** Payments in dollars: the line in bolívares, as the school adds it up. Empty in bolívares. */
  amountVesFormatted: string;
}

export interface PayrollReceiptData {
  schoolName: string;
  beneficiaryName: string;
  documentId: string;
  categoryLabel: string;
  periodName: string;
  periodRange: string;
  currency: PayrollCurrency;
  earnings: PayrollReceiptLine[];
  deductions: PayrollReceiptLine[];
  grossFormatted: string;
  deductionsFormatted: string;
  grossVesFormatted: string;
  deductionsVesFormatted: string;
  netFormatted: string;
  netVesFormatted: string;
  exchangeRateFormatted: string;
  methodLabel: string;
  paymentDateFormatted: string;
  paymentReference: string;
  notes: string;
}

/** Format money with es-VE grouping and 2 decimals, prefixed with the currency code. */
export function formatMoney(amount: number, currency: PayrollCurrency): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${value.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
}

/** Exchange rates keep up to 4 decimals (the BCV publishes more than the 2 usually shown). */
export function formatRate(rate: number): string {
  return rate.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function buildPayrollReceiptData(input: PayrollReceiptInput): PayrollReceiptData {
  const totals = calculatePayrollTotals(input.items);
  const rate = input.exchangeRate > 0 ? input.exchangeRate : 0;
  const isUsd = input.currency !== "VES";
  // Lines saved with their bolívares add up exactly; older lines are converted.
  const lineVes = (item: PayrollLineItem) =>
    !isUsd ? Number(item.amount) || 0 : item.amount_ves != null ? Number(item.amount_ves) : round2((Number(item.amount) || 0) * rate);
  const sumVes = (kind: "earning" | "deduction") =>
    round2(input.items.filter((i) => i.concept_kind === kind).reduce((sum, i) => sum + lineVes(i), 0));
  const grossVes = sumVes("earning");
  const deductionsVes = sumVes("deduction");
  const netVes = Math.max(0, round2(grossVes - deductionsVes));

  const toLine = (item: PayrollLineItem): PayrollReceiptLine => ({
    description: item.description?.trim() || "Concepto",
    amountFormatted: formatMoney(item.amount, input.currency),
    amountVesFormatted: isUsd ? formatMoney(lineVes(item), "VES") : "",
  });

  return {
    schoolName: input.schoolName || "—",
    beneficiaryName: input.beneficiaryName || "—",
    documentId: input.documentId || "—",
    categoryLabel: CATEGORY_LABELS[input.category] ?? input.category,
    periodName: input.periodName || "—",
    periodRange: `${formatDate(input.periodStart)} — ${formatDate(input.periodEnd)}`,
    currency: input.currency,
    earnings: input.items.filter((i) => i.concept_kind === "earning").map(toLine),
    deductions: input.items.filter((i) => i.concept_kind === "deduction").map(toLine),
    grossFormatted: formatMoney(totals.gross, input.currency),
    deductionsFormatted: formatMoney(totals.deductions, input.currency),
    grossVesFormatted: formatMoney(grossVes, "VES"),
    deductionsVesFormatted: formatMoney(deductionsVes, "VES"),
    netFormatted: formatMoney(totals.net, input.currency),
    netVesFormatted: formatMoney(netVes, "VES"),
    exchangeRateFormatted: input.currency === "VES" ? "—" : formatRate(input.exchangeRate),
    methodLabel: input.methodType
      ? input.methodLabel?.trim() || METHOD_LABELS[input.methodType]
      : "—",
    paymentDateFormatted: formatDate(input.paymentDate),
    paymentReference: input.paymentReference?.trim() || "—",
    notes: input.notes?.trim() || "",
  };
}
