// Shapes a withholding into what the voucher needs, from its own copy of the data: a voucher
// reprinted later comes out the same even if the supplier changed its address.

import { formatDateOnly } from "@/lib/dateUtils";
import { round2 } from "../calculateNet";
import { TAX_TYPE_LABELS, type TaxType, type WithholdingStatus } from "./types";

export interface WithholdingDocument {
  document_type: string;
  document_number: string;
  control_number: string;
  issue_date: string;
  total_amount: number;
  taxable_base: number;
  exempt_amount: number;
  vat_rate_pct: number;
  vat_amount: number;
}

export interface WithholdingRow {
  id: string;
  school_id: string;
  payment_id: string;
  beneficiary_id: string;
  tax_type: TaxType;
  source: "invoice" | "salary";
  status: WithholdingStatus;
  base_ves: number;
  base_pct: number;
  rate_pct: number;
  tax_amount_ves: number;
  subtrahend_ves: number;
  minimum_ves: number;
  exchange_rate: number;
  withheld_ves: number;
  no_withholding_reason: string | null;
  islr_concept_name: string | null;
  islr_seniat_code: string | null;
  is_override: boolean;
  override_reason: string | null;
  beneficiary_snapshot: { name?: string; tax_id?: string | null; document_id?: string | null; fiscal_address?: string | null; email?: string | null };
  agent_snapshot: { name?: string; tax_id?: string | null; fiscal_address?: string | null };
  fiscal_period_start: string | null;
  fiscal_period_end: string | null;
  voucher_number: string | null;
  issued_at: string | null;
  delivered_at: string | null;
  declared_at: string | null;
  declaration_ref: string | null;
  remitted_at: string | null;
  remittance_ref: string | null;
  payroll_purchase_documents: WithholdingDocument | null;
}

/** One row of the voucher's table, in bolívares. */
export interface VoucherOperation {
  date: string;
  /** Invoice number; empty for a debit note, whose number goes in debitNoteNumber. */
  invoiceNumber: string;
  debitNoteNumber: string;
  controlNumber: string;
  transactionType: string;
  totalVes: number;
  exemptVes: number;
  baseVes: number;
  vatRatePct: number;
  taxVes: number;
  /** ISLR: the SENIAT code of the concept, or its name when it has none. */
  conceptCode: string;
  ratePct: number;
  subtrahendVes: number;
  withheldVes: number;
}

export interface VoucherData {
  title: string;
  taxType: TaxType;
  fiscalYear: string;
  fiscalMonth: string;
  operation: VoucherOperation;
  voucherNumber: string;
  issueDate: string;
  deliveryDate: string;
  fiscalPeriod: string;
  agent: { name: string; taxId: string; address: string };
  supplier: { name: string; taxId: string; address: string; email: string };
  documentLabel: string;
  documentNumber: string;
  controlNumber: string;
  documentDate: string;
  rows: { label: string; amount: number }[];
  ratePct: number;
  withheldVes: number;
  conceptName: string | null;
  isVoided: boolean;
}

const dash = (value: string | null | undefined) => value?.trim() || "—";

/** dd/mm/aaaa, as vouchers print dates. */
const voucherDate = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

export function buildWithholdingVoucherData(row: WithholdingRow): VoucherData {
  const doc = row.payroll_purchase_documents;
  const rate = row.exchange_rate > 0 ? row.exchange_rate : 1;
  const toVes = (amount: number | undefined) => round2((amount ?? 0) * rate);

  const rows =
    row.tax_type === "vat"
      ? [
          { label: "Monto total de la factura", amount: toVes(doc?.total_amount) },
          { label: "Base imponible", amount: row.base_ves },
          { label: "Monto exento", amount: toVes(doc?.exempt_amount) },
          { label: `Impuesto causado (${doc?.vat_rate_pct ?? 0} %)`, amount: row.tax_amount_ves },
        ]
      : [
          { label: "Monto total de la factura", amount: toVes(doc?.total_amount) },
          { label: "Monto sujeto a retención", amount: row.base_ves },
          ...(row.subtrahend_ves > 0 ? [{ label: "Sustraendo", amount: row.subtrahend_ves }] : []),
        ];

  const isDebitNote = doc?.document_type === "debit_note";
  const operation: VoucherOperation = {
    date: voucherDate(doc?.issue_date),
    invoiceNumber: isDebitNote ? "" : dash(doc?.document_number),
    debitNoteNumber: isDebitNote ? dash(doc?.document_number) : "",
    controlNumber: dash(doc?.control_number),
    transactionType: isDebitNote ? "02-Nota de débito" : "01-Factura",
    totalVes: toVes(doc?.total_amount),
    exemptVes: toVes(doc?.exempt_amount),
    baseVes: row.base_ves,
    vatRatePct: doc?.vat_rate_pct ?? 0,
    taxVes: row.tax_amount_ves,
    conceptCode: row.islr_seniat_code?.trim() || row.islr_concept_name?.trim() || "—",
    ratePct: row.rate_pct,
    subtrahendVes: row.subtrahend_ves,
    withheldVes: row.withheld_ves,
  };
  const fiscalDate = row.fiscal_period_start ?? row.issued_at?.slice(0, 10) ?? "";

  return {
    title: `Comprobante de retención de ${TAX_TYPE_LABELS[row.tax_type]}`,
    taxType: row.tax_type,
    fiscalYear: fiscalDate.slice(0, 4) || "—",
    fiscalMonth: fiscalDate.slice(5, 7) || "—",
    operation,
    voucherNumber: dash(row.voucher_number),
    issueDate: voucherDate(row.issued_at),
    deliveryDate: row.delivered_at ? formatDateOnly(row.delivered_at.slice(0, 10)) : "—",
    fiscalPeriod:
      row.fiscal_period_start && row.fiscal_period_end
        ? `${formatDateOnly(row.fiscal_period_start)} al ${formatDateOnly(row.fiscal_period_end)}`
        : "—",
    agent: {
      name: dash(row.agent_snapshot.name),
      taxId: dash(row.agent_snapshot.tax_id),
      address: dash(row.agent_snapshot.fiscal_address),
    },
    supplier: {
      name: dash(row.beneficiary_snapshot.name),
      taxId: dash(row.beneficiary_snapshot.tax_id),
      address: dash(row.beneficiary_snapshot.fiscal_address),
      email: dash(row.beneficiary_snapshot.email),
    },
    documentLabel: doc?.document_type === "debit_note" ? "Nota de débito" : "Factura",
    documentNumber: dash(doc?.document_number),
    controlNumber: dash(doc?.control_number),
    documentDate: doc?.issue_date ? formatDateOnly(doc.issue_date) : "—",
    rows,
    ratePct: row.rate_pct,
    withheldVes: row.withheld_ves,
    conceptName: row.islr_concept_name,
    isVoided: row.status === "voided",
  };
}

export interface AnnualCertificateLine {
  period: string;
  base: number;
  ratePct: number;
  withheld: number;
}

export interface AnnualCertificate {
  year: number;
  agent: { name: string; taxId: string };
  worker: { name: string; taxId: string; documentId: string };
  lines: AnnualCertificateLine[];
  totalBase: number;
  totalWithheld: number;
}

/** Yearly salary withholdings of one worker (ARC). Voided ones don't count. */
export function buildAnnualCertificate(rows: WithholdingRow[], year: number): AnnualCertificate | null {
  const valid = rows
    .filter((r) => r.source === "salary" && r.status !== "voided" && r.fiscal_period_start?.startsWith(String(year)))
    .sort((a, b) => (a.fiscal_period_start ?? "").localeCompare(b.fiscal_period_start ?? ""));
  if (valid.length === 0) return null;

  const latest = valid[valid.length - 1];
  const lines = valid.map((r) => ({
    period: r.fiscal_period_start ? formatDateOnly(r.fiscal_period_start) : "—",
    base: r.base_ves,
    ratePct: r.rate_pct,
    withheld: r.withheld_ves,
  }));

  return {
    year,
    agent: { name: dash(latest.agent_snapshot.name), taxId: dash(latest.agent_snapshot.tax_id) },
    worker: {
      name: dash(latest.beneficiary_snapshot.name),
      taxId: dash(latest.beneficiary_snapshot.tax_id),
      documentId: dash(latest.beneficiary_snapshot.document_id),
    },
    lines,
    totalBase: round2(lines.reduce((sum, l) => sum + l.base, 0)),
    totalWithheld: round2(lines.reduce((sum, l) => sum + l.withheld, 0)),
  };
}
