// A payroll paid in dollars must add up in bolívares the way schools do it on their sheets:
// each salary converted at the BCV rate (all its decimals) and rounded to 2 decimals, and the
// contributions calculated on those bolívares, also rounded to 2 decimals. Made-up amounts;
// the month has 5 Mondays (November 2026).

import { describe, expect, it } from "vitest";
import { buildSalaryPaymentDraft } from "../withholdings/buildPaymentDraft";
import { buildPayrollReceiptData } from "../buildPayrollReceiptData";
import type { ContributionParameters } from "./types";

const parameters: ContributionParameters = {
  id: "cp1",
  school_id: "s",
  valid_from: "2026-01-01",
  minimum_wage_ves: 130,
  ivss_pct: 4,
  ivss_cap_wages: 5,
  ivss_method: "mondays",
  rpe_pct: 0.5,
  rpe_cap_wages: 10,
  rpe_method: "mondays",
  faov_pct: 1,
  faov_cap_wages: 0,
  faov_method: "monthly",
};

const RATE = 412.5617;

function payroll(salaryUsd: number) {
  return buildSalaryPaymentDraft({
    vatEnabled: false,
    islrEnabled: false,
    date: "2026-11-30",
    parameters: [],
    currency: "USD",
    exchangeRate: RATE,
    ariRates: [],
    lines: [{ concept_kind: "earning", description: "Salario mensual", amount: salaryUsd, isTaxable: true }],
    applyDeductions: true,
    monthDate: "2026-11-30",
    priorPayments: [],
    contributionsEnabled: true,
    contributionParameters: [parameters],
  });
}

const ves = (draft: ReturnType<typeof payroll>, key: string) =>
  draft.items.find((i) => i.contribution_key === `contribution:${key}`)?.amount_ves;

describe("nómina en dólares que cuadra en bolívares", () => {
  it.each([
    // salario $, sueldo Bs, paro forzoso, FAOV, total descuentos, total a pagar (Bs)
    [2, 825.12, 4.76, 8.25, 43.01, 782.11],
    [3, 1237.69, 7.14, 12.38, 49.52, 1188.17],
    [5, 2062.81, 7.5, 20.63, 58.13, 2004.68],
  ])("salario %s $", (salaryUsd, salaryVes, rpe, faov, deductionsVes, netVes) => {
    const draft = payroll(salaryUsd);
    expect(draft.items[0].amount_ves).toBe(salaryVes);
    expect(ves(draft, "ivss")).toBe(30);
    expect(ves(draft, "rpe")).toBe(rpe);
    expect(ves(draft, "faov")).toBe(faov);
    const deducted = draft.items.filter((i) => i.concept_kind === "deduction").reduce((s, i) => s + (i.amount_ves ?? 0), 0);
    expect(Math.round(deducted * 100) / 100).toBe(deductionsVes);
    expect(draft.totals.netVes).toBe(netVes);
  });

  it("los descuentos en dólares conservan su valor (4 decimales)", () => {
    const draft = payroll(2);
    const ivss = draft.items.find((i) => i.contribution_key === "contribution:ivss");
    expect(ivss?.amount).toBe(0.0727);
    expect(draft.totals.net).toBe(1.9);
  });

  it("el recibo muestra cada línea en bolívares y el neto exacto", () => {
    const draft = payroll(2);
    const receipt = buildPayrollReceiptData({
      schoolName: "Colegio de prueba",
      beneficiaryName: "Trabajadora de prueba",
      documentId: "V-00000000",
      category: "worker",
      periodName: "2da quincena",
      periodStart: "2026-11-16",
      periodEnd: "2026-11-30",
      currency: "USD",
      exchangeRate: RATE,
      items: draft.items,
      methodType: null,
      methodLabel: null,
      paymentDate: null,
      notes: null,
    });
    expect(receipt.deductions.map((d) => d.amountVesFormatted)).toEqual(["VES 30,00", "VES 4,76", "VES 8,25"]);
    expect(receipt.netVesFormatted).toBe("VES 782,11");
    expect(receipt.exchangeRateFormatted).toBe("412,5617");
  });
});
