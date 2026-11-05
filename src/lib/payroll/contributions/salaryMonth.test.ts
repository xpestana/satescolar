import { describe, expect, it } from "vitest";
import { buildSalaryPaymentDraft, type SalaryDraftInput } from "../withholdings/buildPaymentDraft";
import { splitMonthPayments, type MonthPaymentRow } from "./monthBase";
import type { ContributionParameters } from "./types";
import type { PayrollConcept } from "../types";

const contributionParameters: ContributionParameters = {
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

const concepts: PayrollConcept[] = [
  {
    id: "food",
    school_id: "s",
    name: "Bono de alimentación",
    concept_kind: "earning",
    default_amount: 0,
    currency: "VES",
    is_active: true,
    is_islr_taxable: false,
    is_contribution_base: false,
  },
];

const base: SalaryDraftInput = {
  vatEnabled: false,
  islrEnabled: true,
  date: "2026-11-30",
  parameters: [],
  currency: "VES",
  exchangeRate: 1,
  ariRates: [{ id: "a1", school_id: "s", beneficiary_id: "b", valid_from: "2026-01-01", rate_pct: 2 }],
  lines: [{ concept_kind: "earning", description: "Sueldo 2da quincena", amount: 1000, isTaxable: true }],
  monthDate: "2026-11-30",
  contributionsEnabled: true,
  contributionParameters: [contributionParameters],
};

const firstHalf = (overrides: Partial<MonthPaymentRow> = {}): MonthPaymentRow => ({
  id: "p1",
  status: "paid",
  currency: "VES",
  exchange_rate: 1,
  period: { id: "q1", name: "1ra quincena noviembre", end_date: "2026-11-15", apply_deductions: false },
  items: [
    { concept_id: null, concept_kind: "earning", amount: 1000, withholding_id: null, contribution_id: null },
    { concept_id: "food", concept_kind: "earning", amount: 500, withholding_id: null, contribution_id: null },
  ],
  contributions: [],
  ...overrides,
});

describe("período que no descuenta", () => {
  it("paga completo: sin AR-I ni parafiscales", () => {
    const draft = buildSalaryPaymentDraft({ ...base, applyDeductions: false });
    expect(draft.withholdings).toEqual([]);
    expect(draft.contributions).toEqual([]);
    expect(draft.totals.net).toBe(1000);
    expect(draft.monthBasePaymentIds).toBeNull();
  });
});

describe("2da quincena que descuenta todo el mes", () => {
  const month = splitMonthPayments([firstHalf()], "2026-11-30", concepts);
  const draft = buildSalaryPaymentDraft({ ...base, applyDeductions: true, priorPayments: month.prior });

  it("suma la 1ra quincena a la base, sin el bono excluido", () => {
    expect(draft.monthBase?.islrBaseVes).toBe(2000);
    expect(draft.monthBase?.contributionBaseVes).toBe(2000);
    expect(draft.monthBasePaymentIds).toEqual(["p1"]);
  });

  it("retiene el AR-I sobre el mes", () => {
    expect(draft.withholdings[0].base_ves).toBe(2000);
    expect(draft.withholdings[0].withheld_ves).toBe(40);
  });

  it("descuenta los parafiscales del mes", () => {
    const amounts = Object.fromEntries(draft.contributions.map((c) => [c.kind, c.amount]));
    expect(amounts).toEqual({ ivss: 30, rpe: 7.5, faov: 20 });
    expect(draft.totals.net).toBe(1000 - 40 - 30 - 7.5 - 20);
    const ivssLine = draft.items.find((i) => i.contribution_key === "contribution:ivss");
    expect(ivssLine?.description).toBe("IVSS 4 % (5 lunes)");
  });
});

describe("las dos quincenas descuentan", () => {
  it("la 2da descuenta lo que falta del mes y el AR-I solo de lo suyo", () => {
    const paidWithDeductions = firstHalf({
      period: { id: "q1", name: "1ra quincena noviembre", end_date: "2026-11-15", apply_deductions: true },
      contributions: [
        { kind: "ivss", amount_ves: 18 },
        { kind: "rpe", amount_ves: 3.75 },
        { kind: "faov", amount_ves: 10 },
      ],
    });
    const month = splitMonthPayments([paidWithDeductions], "2026-11-30", concepts);
    const draft = buildSalaryPaymentDraft({ ...base, applyDeductions: true, priorPayments: month.prior });
    expect(draft.monthBase?.islrBaseVes).toBe(1000);
    const amounts = Object.fromEntries(draft.contributions.map((c) => [c.kind, c.amount]));
    expect(amounts).toEqual({ ivss: 12, rpe: 3.75, faov: 10 });
  });
});

describe("splitMonthPayments", () => {
  it("ignora anulados, otros meses y avisa de pagos posteriores que descuentan", () => {
    const later = firstHalf({
      id: "p3",
      status: "approved",
      period: { id: "q2", name: "2da quincena noviembre", end_date: "2026-11-30", apply_deductions: true },
    });
    const rows = [
      firstHalf({ id: "void", status: "voided" }),
      firstHalf({ id: "oct", period: { id: "o", name: "Octubre", end_date: "2026-10-31", apply_deductions: false } }),
      later,
    ];
    const month = splitMonthPayments(rows, "2026-11-15", concepts);
    expect(month.prior).toEqual([]);
    expect(month.laterDiscounting).toEqual([{ id: "p3", label: "2da quincena noviembre", status: "approved" }]);
  });

  it("convierte a bolívares los pagos en dólares", () => {
    const usd = firstHalf({ currency: "USD", exchange_rate: 40, items: [
      { concept_id: null, concept_kind: "earning", amount: 25, withholding_id: null, contribution_id: null },
    ] });
    const month = splitMonthPayments([usd], "2026-11-30", concepts);
    expect(month.prior[0].contributionBaseVes).toBe(1000);
  });
});

describe("sin valores de parafiscales", () => {
  it("avisa en vez de calcular", () => {
    const draft = buildSalaryPaymentDraft({ ...base, contributionParameters: [] });
    expect(draft.errors).toContain("No hay valores de parafiscales vigentes para la fecha del pago. Revíselos en Configuración.");
  });
});
