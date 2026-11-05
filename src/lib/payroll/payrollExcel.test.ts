import { describe, expect, it } from "vitest";
import {
  buildPayrollExcelRows,
  PAYROLL_EXCEL_HEADER,
  type PayrollExcelRow,
} from "./payrollExcel";

const row = (over: Partial<PayrollExcelRow> = {}): PayrollExcelRow => ({
  beneficiaryName: "Ana",
  documentId: "V-1",
  category: "admin",
  periodName: "Julio 2026",
  status: "paid",
  currency: "VES",
  gross: 1000,
  deductions: 100,
  net: 900,
  netVes: 900,
  methodLabel: "Efectivo",
  paymentDate: "2026-07-31",
  ...over,
});

describe("buildPayrollExcelRows", () => {
  it("emite header, filas traducidas y fila de totales", () => {
    const aoa = buildPayrollExcelRows([row(), row({ beneficiaryName: "Luis", netVes: 500 })]);
    expect(aoa[0]).toEqual(PAYROLL_EXCEL_HEADER);
    expect(aoa[1][2]).toBe("Administrativo"); // category label
    expect(aoa[1][4]).toBe("Pagado"); // status label
    expect(aoa).toHaveLength(4); // header + 2 rows + totals
    expect(aoa[3][0]).toBe("TOTAL (VES)");
    expect(aoa[3][9]).toBe(1400);
  });

  it("incluye la referencia del pago, con guion si falta", () => {
    const aoa = buildPayrollExcelRows([row({ paymentReference: " 000123 " }), row()]);
    expect(aoa[0][12]).toBe("Referencia");
    expect(aoa[1][12]).toBe("000123");
    expect(aoa[2][12]).toBe("—");
    expect(aoa[3]).toHaveLength(aoa[0].length);
  });

  it("excluye anulados del total", () => {
    const aoa = buildPayrollExcelRows([row({ netVes: 900 }), row({ status: "voided", netVes: 500 })]);
    expect(aoa[3][9]).toBe(900);
  });

  it("lista vacía deja header y total en 0", () => {
    const aoa = buildPayrollExcelRows([]);
    expect(aoa).toHaveLength(2);
    expect(aoa[1][9]).toBe(0);
  });
});
