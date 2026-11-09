import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PayrollPaymentFormModal } from "./PayrollPaymentFormModal";
import type { MonthPaymentRow } from "@/lib/payroll/contributions/monthBase";

const register = vi.fn();
let periodApplies = true;
let monthRows: MonthPaymentRow[] = [];

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
let concepts: unknown[] = [];
let own: unknown[] = [];
vi.mock("@/hooks/payroll/usePayrollConcepts", () => ({ usePayrollConcepts: () => ({ concepts, isLoading: false }) }));
vi.mock("@/hooks/payroll/usePayrollBeneficiaryConcepts", () => ({
  usePayrollBeneficiaryConcepts: () => ({ own, isFetched: true }),
}));
vi.mock("@/hooks/payroll/usePayrollMethods", () => ({ usePayrollMethods: () => ({ methods: [] }) }));
vi.mock("@/hooks/payroll/usePayrollUsdRate", () => ({ usePayrollUsdRate: () => ({ data: 0 }) }));
vi.mock("@/hooks/payroll/usePayrollPayments", () => ({
  usePayrollPayments: () => ({ registerPayment: { mutate: register, isPending: false } }),
}));
vi.mock("@/hooks/payroll/usePayrollTaxConfig", () => ({
  usePayrollTaxConfig: () => ({ islrEnabled: true, vatEnabled: false, parameters: [] }),
}));
vi.mock("@/hooks/payroll/usePayrollAriRates", () => ({
  usePayrollAriRates: () => ({
    ratesByBeneficiary: { b1: [{ id: "a1", school_id: "s1", beneficiary_id: "b1", valid_from: "2026-01-01", rate_pct: 2 }] },
  }),
}));
vi.mock("@/hooks/payroll/usePayrollPeriods", () => ({
  usePayrollPeriods: () => ({
    periods: [
      {
        id: "q2",
        name: periodApplies ? "2da quincena noviembre" : "1ra quincena noviembre",
        period_type: "biweekly",
        start_date: periodApplies ? "2026-11-16" : "2026-11-01",
        end_date: periodApplies ? "2026-11-30" : "2026-11-15",
        apply_deductions: periodApplies,
      },
    ],
  }),
}));
vi.mock("@/hooks/payroll/usePayrollContributionConfig", () => ({
  usePayrollContributionConfig: () => ({
    enabled: true,
    parameters: [
      {
        id: "cp1",
        school_id: "s1",
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
      },
    ],
  }),
}));
vi.mock("@/hooks/payroll/usePayrollMonthPayments", () => ({
  usePayrollMonthPayments: () => ({ data: monthRows, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/dateUtils", async (original) => ({
  ...(await original<typeof import("@/lib/dateUtils")>()),
  todayCaracasIso: () => "2026-11-30",
}));

const firstHalf: MonthPaymentRow = {
  id: "p1",
  status: "paid",
  currency: "VES",
  exchange_rate: 1,
  period: { id: "q1", name: "1ra quincena noviembre", end_date: "2026-11-15", apply_deductions: false },
  items: [{ concept_id: null, concept_kind: "earning", amount: 1000, withholding_id: null, contribution_id: null }],
  contributions: [],
};

function fillSalary(amount: string) {
  render(
    <PayrollPaymentFormModal open onOpenChange={vi.fn()} schoolId="s1" periodId="q2" beneficiary={{ id: "b1", full_name: "Ana Pérez" }} />
  );
  fireEvent.change(screen.getByPlaceholderText("Descripción"), { target: { value: "Sueldo" } });
  fireEvent.change(screen.getByPlaceholderText("Monto"), { target: { value: amount } });
}

describe("PayrollPaymentFormModal: descuento por período", () => {
  beforeEach(() => {
    register.mockReset();
    monthRows = [];
    concepts = [];
    own = [];
  });

  it("la 1ra quincena que no descuenta se paga completa", () => {
    periodApplies = false;
    fillSalary("1000");
    expect(screen.getByText(/no descuenta retenciones ni parafiscales/)).toBeInTheDocument();
    expect(screen.queryByText(/AR-I/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    const payload = register.mock.calls[0][0];
    expect(payload.withholdings).toEqual([]);
    expect(payload.contributions).toEqual([]);
    expect(payload.month_base_payment_ids).toBeNull();
  });

  it("la 2da quincena suma la 1ra y descuenta todo el mes", () => {
    periodApplies = true;
    monthRows = [firstHalf];
    fillSalary("1000");
    expect(screen.getByText("Base del mes")).toBeInTheDocument();
    expect(screen.getByText("1ra quincena noviembre")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    const payload = register.mock.calls[0][0];
    expect(payload.month_base_payment_ids).toEqual(["p1"]);
    expect(payload.withholdings[0].base_ves).toBe(2000);
    expect(payload.contributions.map((c: { kind: string; amount: number }) => [c.kind, c.amount])).toEqual([
      ["ivss", 30],
      ["rpe", 7.5],
      ["faov", 20],
    ]);
  });
});

describe("PayrollPaymentFormModal: conceptos por defecto", () => {
  const concept = (id: string, extra: Record<string, unknown>) => ({
    id, school_id: "s1", name: id, concept_kind: "earning", default_amount: 0, currency: "USD", is_active: true,
    is_islr_taxable: true, is_contribution_base: false, is_base_salary: false, is_default: false, default_categories: [], ...extra,
  });

  beforeEach(() => {
    register.mockReset();
    monthRows = [];
    periodApplies = false;
  });

  it("abre el pago en dólares con sus conceptos y su sueldo propio", () => {
    concepts = [
      concept("Sueldo base", { default_amount: 1.5, is_default: true, is_base_salary: true, is_contribution_base: true }),
      concept("Cesta ticket", { default_amount: 40, is_default: true, is_islr_taxable: false }),
      concept("Prima docente", { default_amount: 5, is_default: true, default_categories: ["teacher"] }),
    ];
    own = [{ concept_id: "Sueldo base", enabled: true, amount: 3 }];
    render(
      <PayrollPaymentFormModal open onOpenChange={vi.fn()} schoolId="s1" periodId="q2" beneficiary={{ id: "b1", full_name: "Ana Pérez", category: "worker" }} />
    );
    expect(screen.getByText(/Salieron puestos los conceptos/)).toBeInTheDocument();
    const amounts = screen.getAllByPlaceholderText("Monto").map((input) => (input as HTMLInputElement).value);
    expect(amounts).toEqual(["3", "40"]);
    expect(screen.getAllByPlaceholderText("Descripción").map((input) => (input as HTMLInputElement).value)).toEqual([
      "Sueldo base",
      "Cesta ticket",
    ]);
  });
});
