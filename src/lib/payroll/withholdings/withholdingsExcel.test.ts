import { describe, expect, it } from "vitest";
import type { WithholdingRow } from "./buildWithholdingVoucherData";
import { buildWithholdingSheet, totalWithheld } from "./withholdingsExcel";

const base = {
  id: "w",
  tax_type: "vat",
  source: "invoice",
  status: "issued",
  base_ves: 1000,
  rate_pct: 75,
  tax_amount_ves: 160,
  subtrahend_ves: 0,
  exchange_rate: 1,
  withheld_ves: 120,
  islr_concept_name: null,
  islr_seniat_code: null,
  beneficiary_snapshot: { name: "Servicios CA", tax_id: "J-12345678-9" },
  voucher_number: "20261100000001",
  payroll_purchase_documents: {
    document_type: "invoice",
    document_number: "0001",
    control_number: "00-0001",
    issue_date: "2026-11-01",
    total_amount: 1160,
    taxable_base: 1000,
    exempt_amount: 0,
    vat_rate_pct: 16,
    vat_amount: 160,
  },
} as unknown as WithholdingRow;

describe("withholdings Excel", () => {
  it("writes a header, the rows and a total", () => {
    const sheet = buildWithholdingSheet("vat", [base]);
    expect(sheet).toHaveLength(3);
    expect(sheet[1]).toContain("J-12345678-9");
    expect(sheet[1]).toContain(120);
    expect(sheet[2][0]).toBe("TOTAL");
    expect(sheet[2][sheet[2].length - 2]).toBe(120);
  });

  it("leaves out voided rows and rows with nothing withheld", () => {
    const rows = [base, { ...base, status: "voided" }, { ...base, withheld_ves: 0 }] as WithholdingRow[];
    expect(totalWithheld(rows)).toBe(120);
    expect(buildWithholdingSheet("vat", rows)).toHaveLength(3);
  });

  it("uses the ISLR columns, with the concept and its code", () => {
    const islr = { ...base, tax_type: "islr", islr_concept_name: "Contratistas", islr_seniat_code: "053", withheld_ves: 20, rate_pct: 2 } as WithholdingRow;
    const sheet = buildWithholdingSheet("islr", [islr]);
    expect(sheet[0]).toContain("Código SENIAT");
    expect(sheet[1]).toContain("Contratistas");
    expect(sheet[1]).toContain("053");
  });

  it("handles an empty period", () => {
    expect(buildWithholdingSheet("vat", [])).toHaveLength(2);
    expect(totalWithheld([])).toBe(0);
  });
});
