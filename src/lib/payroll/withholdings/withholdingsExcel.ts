// Declaration data as Excel. Provisional format: the exact IVA and ISLR files of the SENIAT
// portal replace `buildWithholdingSheet` once we have real samples; the screen doesn't change.

import * as XLSX from "xlsx";
import { formatDateOnly } from "@/lib/dateUtils";
import { round2 } from "../calculateNet";
import type { WithholdingRow } from "./buildWithholdingVoucherData";
import { TAX_TYPE_LABELS, WITHHOLDING_STATUS_LABELS, type TaxType } from "./types";

type Cell = string | number;

const HEADER: Record<TaxType, string[]> = {
  vat: [
    "N° comprobante", "Fecha de factura", "RIF proveedor", "Proveedor", "N° factura", "N° control",
    "Total factura (Bs)", "Base imponible (Bs)", "Exento (Bs)", "Alícuota %", "IVA causado (Bs)",
    "% retención", "IVA retenido (Bs)", "Estado",
  ],
  islr: [
    "N° comprobante", "Fecha de factura", "RIF retenido", "Retenido", "N° factura", "N° control", "Concepto",
    "Código SENIAT", "Monto sujeto (Bs)", "% retención", "Sustraendo (Bs)", "ISLR retenido (Bs)", "Estado",
  ],
};

/** Only withholdings with an amount, which aren't voided, count for the declaration. */
export function declarableWithholdings(rows: WithholdingRow[]): WithholdingRow[] {
  return rows.filter((r) => r.status !== "voided" && r.withheld_ves > 0);
}

export function totalWithheld(rows: WithholdingRow[]): number {
  return round2(declarableWithholdings(rows).reduce((sum, r) => sum + r.withheld_ves, 0));
}

export function buildWithholdingSheet(taxType: TaxType, rows: WithholdingRow[]): Cell[][] {
  const body = declarableWithholdings(rows).map((r): Cell[] => {
    const doc = r.payroll_purchase_documents;
    const rate = r.exchange_rate > 0 ? r.exchange_rate : 1;
    const shared: Cell[] = [
      r.voucher_number ?? "",
      doc?.issue_date ? formatDateOnly(doc.issue_date) : "",
      r.beneficiary_snapshot.tax_id ?? r.beneficiary_snapshot.document_id ?? "",
      r.beneficiary_snapshot.name ?? "",
      doc?.document_number ?? "",
      doc?.control_number ?? "",
    ];
    const status = WITHHOLDING_STATUS_LABELS[r.status];
    if (taxType === "vat") {
      return [
        ...shared,
        round2((doc?.total_amount ?? 0) * rate),
        r.base_ves,
        round2((doc?.exempt_amount ?? 0) * rate),
        doc?.vat_rate_pct ?? 0,
        r.tax_amount_ves,
        r.rate_pct,
        r.withheld_ves,
        status,
      ];
    }
    return [
      ...shared,
      r.islr_concept_name ?? "",
      r.islr_seniat_code ?? "",
      r.base_ves,
      r.rate_pct,
      r.subtrahend_ves,
      r.withheld_ves,
      status,
    ];
  });

  const totals: Cell[] = HEADER[taxType].map(() => "");
  totals[0] = "TOTAL";
  totals[totals.length - 2] = totalWithheld(rows);
  return [HEADER[taxType], ...body, totals];
}

export function exportWithholdingsExcel(taxType: TaxType, rows: WithholdingRow[], periodLabel: string): void {
  const data = buildWithholdingSheet(taxType, rows);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = data[0].map((_, column) => ({
    wch: Math.max(...data.map((row) => String(row[column] ?? "").length)) + 2,
  }));
  const workbook = XLSX.utils.book_new();
  const label = TAX_TYPE_LABELS[taxType];
  XLSX.utils.book_append_sheet(workbook, sheet, `Retenciones ${label}`);
  XLSX.writeFile(workbook, `retenciones-${label.toLowerCase()}-${periodLabel}.xlsx`);
}
