import { describe, expect, it } from "vitest";
import { buildAnnualCertificate, buildWithholdingVoucherData, type WithholdingRow } from "./buildWithholdingVoucherData";

const row: WithholdingRow = {
  id: "w1",
  school_id: "s",
  payment_id: "p",
  beneficiary_id: "b",
  tax_type: "vat",
  source: "invoice",
  status: "issued",
  base_ves: 1000,
  base_pct: 100,
  rate_pct: 75,
  tax_amount_ves: 160,
  subtrahend_ves: 0,
  minimum_ves: 0,
  exchange_rate: 1,
  withheld_ves: 120,
  no_withholding_reason: null,
  islr_concept_name: null,
  islr_seniat_code: null,
  is_override: false,
  override_reason: null,
  beneficiary_snapshot: { name: "Servicios CA", tax_id: "J-12345678-9", fiscal_address: "Caracas", email: "a@example.com" },
  agent_snapshot: { name: "Colegio", tax_id: "J-00000000-1", fiscal_address: "Valencia" },
  fiscal_period_start: "2026-11-01",
  fiscal_period_end: "2026-11-15",
  voucher_number: "20261100000001",
  issued_at: "2026-11-04T15:00:00Z",
  delivered_at: null,
  declared_at: null,
  declaration_ref: null,
  remitted_at: null,
  remittance_ref: null,
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
};

describe("buildWithholdingVoucherData", () => {
  it("carries every field article 18 asks for", () => {
    const data = buildWithholdingVoucherData(row);
    expect(data.voucherNumber).toBe("20261100000001");
    expect(data.agent).toEqual({ name: "Colegio", taxId: "J-00000000-1", address: "Valencia" });
    expect(data.supplier).toEqual({ name: "Servicios CA", taxId: "J-12345678-9", address: "Caracas", email: "a@example.com" });
    expect(data.documentNumber).toBe("0001");
    expect(data.controlNumber).toBe("00-0001");
    expect(data.fiscalPeriod).toContain("al");
    expect(data.rows.map((r) => r.amount)).toEqual([1160, 1000, 0, 160]);
    expect(data.withheldVes).toBe(120);
    expect(data.issueDate).toBe("04/11/2026");
    expect(data.operation.date).toBe("01/11/2026");
    expect([data.fiscalYear, data.fiscalMonth]).toEqual(["2026", "11"]);
  });

  it("converts documents paid in USD to bolivars", () => {
    const usd = {
      ...row,
      exchange_rate: 100,
      payroll_purchase_documents: { ...row.payroll_purchase_documents!, total_amount: 11.6 },
    };
    expect(buildWithholdingVoucherData(usd).rows[0].amount).toBe(1160);
  });

  it("shows the subtrahend only on ISLR when there is one", () => {
    const islr: WithholdingRow = { ...row, tax_type: "islr", subtrahend_ves: 107.5, base_ves: 10000 };
    expect(buildWithholdingVoucherData(islr).rows.map((r) => r.label)).toContain("Sustraendo");
    expect(buildWithholdingVoucherData({ ...islr, subtrahend_ves: 0 }).rows.map((r) => r.label)).not.toContain("Sustraendo");
  });

  it("marks a voided voucher", () => {
    expect(buildWithholdingVoucherData({ ...row, status: "voided" }).isVoided).toBe(true);
  });
});

describe("buildAnnualCertificate", () => {
  const salary: WithholdingRow = {
    ...row,
    tax_type: "islr",
    source: "salary",
    rate_pct: 2,
    base_ves: 10000,
    withheld_ves: 200,
    fiscal_period_start: "2026-01-01",
    payroll_purchase_documents: null,
  };

  it("adds up the worker's year in order", () => {
    const certificate = buildAnnualCertificate(
      [{ ...salary, id: "b", fiscal_period_start: "2026-02-01" }, { ...salary, id: "a" }],
      2026
    );
    expect(certificate?.totalBase).toBe(20000);
    expect(certificate?.totalWithheld).toBe(400);
    expect(certificate?.lines).toHaveLength(2);
  });

  it("ignores voided rows, other years and invoices", () => {
    const certificate = buildAnnualCertificate(
      [
        salary,
        { ...salary, id: "v", status: "voided" },
        { ...salary, id: "y", fiscal_period_start: "2025-12-01" },
        { ...salary, id: "i", source: "invoice" },
      ],
      2026
    );
    expect(certificate?.totalWithheld).toBe(200);
  });

  it("returns null when there's nothing that year", () => {
    expect(buildAnnualCertificate([salary], 2024)).toBeNull();
  });
});
