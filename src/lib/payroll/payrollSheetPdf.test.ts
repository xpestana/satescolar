import { describe, expect, it } from "vitest";
import { buildPayrollSheetRows, type SheetPaymentInput } from "./payrollSheet";
import { generatePayrollSheetPdf } from "./payrollSheetPdf";

const worker = (name: string, salaryUsd: number, grossVes: number, faov: number): SheetPaymentInput => ({
  status: "paid",
  currency: "USD",
  exchange_rate: 412.5617,
  payment_reference: "123456",
  beneficiary: { full_name: name, document_id: "V-1", hire_date: "2020-01-07", job_title: "Aseadora", category: "worker" },
  items: [
    { concept_kind: "earning", amount: salaryUsd, amount_ves: grossVes, withholding_id: null, contribution_kind: null },
    { concept_kind: "deduction", amount: 0.07, amount_ves: 24, withholding_id: null, contribution_kind: "ivss" },
    { concept_kind: "deduction", amount: 0.02, amount_ves: faov, withholding_id: null, contribution_kind: "faov" },
    { concept_kind: "deduction", amount: 0.01, amount_ves: 6, withholding_id: null, contribution_kind: "rpe" },
  ],
});

const heading = {
  schoolName: "COLEGIO DE PRUEBA C.A",
  schoolRif: "J000000000",
  periodName: "2da quincena octubre 2026",
  periodStart: "2026-10-16",
  periodEnd: "2026-10-31",
};

describe("planilla de nómina en PDF", () => {
  it("imprime encabezado, tasa, filas y totales", () => {
    const rows = buildPayrollSheetRows([worker("Ana", 2, 825.12, 8.25), worker("Beto", 3, 1237.69, 12.38)]);
    const content = generatePayrollSheetPdf(heading, rows).output();
    for (const text of [
      "2DA QUINCENA OCTUBRE 2026",
      "DEL 16/10/2026 AL 31/10/2026",
      "RIF J-00000000-0",
      "NÓMINA OBRERO",
      "TASA 412,5617",
      "Ana",
      "07/01/2020",
      "825,12",
      "TOTALES",
      "2.062,81",
      "48,00",
      "123456",
    ]) {
      expect(content).toContain(text);
    }
  });
});
