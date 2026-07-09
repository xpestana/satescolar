import { describe, expect, it } from "vitest";
import {
  calculatePayrollTotals,
  convertToVes,
  deductionsExceedEarnings,
  round2,
} from "./calculateNet";
import type { PayrollLineItem } from "./types";

const earning = (amount: number): PayrollLineItem => ({ concept_kind: "earning", amount });
const deduction = (amount: number): PayrollLineItem => ({ concept_kind: "deduction", amount });

describe("calculatePayrollTotals", () => {
  it("suma ingresos y deducciones y calcula el neto", () => {
    const totals = calculatePayrollTotals([earning(1000), earning(200), deduction(150)]);
    expect(totals).toEqual({ gross: 1200, deductions: 150, net: 1050 });
  });

  it("lista vacía da todo en 0", () => {
    expect(calculatePayrollTotals([])).toEqual({ gross: 0, deductions: 0, net: 0 });
  });

  it("clampa el neto a 0 cuando las deducciones superan los ingresos", () => {
    const totals = calculatePayrollTotals([earning(100), deduction(300)]);
    expect(totals.net).toBe(0);
    expect(totals.deductions).toBe(300);
  });

  it("trata montos negativos o no finitos como 0", () => {
    const totals = calculatePayrollTotals([earning(-50), earning(NaN), deduction(-10)]);
    expect(totals).toEqual({ gross: 0, deductions: 0, net: 0 });
  });

  it("redondea a 2 decimales", () => {
    const totals = calculatePayrollTotals([earning(10.005), earning(0.005)]);
    expect(totals.gross).toBe(10.01);
  });
});

describe("deductionsExceedEarnings", () => {
  it("detecta cuando la deducción es mayor que el ingreso", () => {
    expect(deductionsExceedEarnings([earning(100), deduction(150)])).toBe(true);
    expect(deductionsExceedEarnings([earning(200), deduction(150)])).toBe(false);
  });
});

describe("convertToVes", () => {
  it("VES se mantiene 1:1 e ignora la tasa", () => {
    expect(convertToVes(1500, "VES", 40)).toBe(1500);
  });

  it("USD multiplica por la tasa a VES", () => {
    expect(convertToVes(100, "USD", 40.5)).toBe(4050);
  });

  it("tasa inválida o 0 en USD produce 0", () => {
    expect(convertToVes(100, "USD", 0)).toBe(0);
    expect(convertToVes(100, "USD", NaN)).toBe(0);
  });
});

describe("round2", () => {
  it("redondea medio centavo hacia arriba", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.5)).toBe(2.5);
    expect(round2(NaN)).toBe(0);
  });
});
