import { describe, expect, it } from "vitest";
import { buildPayrollSheetAoa, buildPayrollSheetRows, groupSheetRows, type SheetPaymentInput } from "./payrollSheet";

const worker = (name: string, overrides: Partial<SheetPaymentInput> = {}): SheetPaymentInput => ({
  status: "paid",
  currency: "USD",
  exchange_rate: 412.5617,
  payment_reference: "123456",
  beneficiary: { full_name: name, document_id: "V-1", hire_date: "2020-01-07", job_title: "Mantenimiento", category: "worker" },
  items: [
    { concept_kind: "earning", amount: 2, amount_ves: 825.12, withholding_id: null, contribution_kind: null },
    { concept_kind: "deduction", amount: 0.0727, amount_ves: 30, withholding_id: null, contribution_kind: "ivss" },
    { concept_kind: "deduction", amount: 0.02, amount_ves: 8.25, withholding_id: null, contribution_kind: "faov" },
    { concept_kind: "deduction", amount: 0.0115, amount_ves: 4.76, withholding_id: null, contribution_kind: "rpe" },
  ],
  ...overrides,
});

describe("planilla de nómina", () => {
  it("arma una fila por trabajador en bolívares", () => {
    const [row] = buildPayrollSheetRows([worker("Ana")]);
    expect(row).toMatchObject({
      hireDate: "07/01/2020",
      jobTitle: "Mantenimiento",
      salaryUsd: 2,
      rate: 412.5617,
      grossVes: 825.12,
      ivss: 30,
      faov: 8.25,
      rpe: 4.76,
      islr: 0,
      otherDeductions: 0,
      totalDeductions: 43.01,
      netVes: 782.11,
      reference: "123456",
    });
  });

  it("separa la retención de ISLR y otros descuentos", () => {
    const payment = worker("Ana");
    payment.items.push(
      { concept_kind: "deduction", amount: 0.05, amount_ves: 20.63, withholding_id: "w1", contribution_kind: null },
      { concept_kind: "deduction", amount: 0.1, amount_ves: 41.26, withholding_id: null, contribution_kind: null }
    );
    const [row] = buildPayrollSheetRows([payment]);
    expect(row.islr).toBe(20.63);
    expect(row.otherDeductions).toBe(41.26);
    expect(row.netVes).toBe(720.22);
  });

  it("los totales suman todas las filas y deja fuera los anulados", () => {
    const rows = buildPayrollSheetRows([worker("Beto"), worker("Ana"), worker("Carla", { status: "voided" })]);
    expect(rows.map((r) => r.name)).toEqual(["Ana", "Beto"]);
    const aoa = buildPayrollSheetAoa(
      { schoolName: "Colegio", schoolRif: "J-1", periodName: "2da quincena", periodStart: "2026-11-16", periodEnd: "2026-11-30" },
      "worker",
      rows
    );
    expect(aoa[3]).toEqual(["DEL 16/11/2026 AL 30/11/2026"]);
    expect(aoa[4]).toEqual(["NÓMINA OBRERO"]);
    const totals = aoa[aoa.length - 1];
    expect(totals[0]).toBe("TOTALES");
    expect(totals.slice(6, 14)).toEqual([1650.24, 60, 16.5, 9.52, 0, 0, 86.02, 1564.22]);
  });

  it("convierte pagos viejos sin bolívares por línea y los pagos en bolívares", () => {
    const old = worker("Ana", {
      items: [{ concept_kind: "earning", amount: 2, amount_ves: null, withholding_id: null, contribution_kind: null }],
    });
    const inVes = worker("Beto", {
      currency: "VES",
      exchange_rate: 1,
      items: [{ concept_kind: "earning", amount: 1000, amount_ves: null, withholding_id: null, contribution_kind: null }],
    });
    const [a, b] = buildPayrollSheetRows([old, inVes]);
    expect(a.grossVes).toBe(825.12);
    expect(b).toMatchObject({ grossVes: 1000, salaryUsd: null, rate: null });
  });

  it("agrupa por categoría", () => {
    const rows = buildPayrollSheetRows([
      worker("Ana"),
      worker("Doc", { beneficiary: { full_name: "Doc", document_id: null, hire_date: null, job_title: null, category: "teacher" } }),
    ]);
    expect(groupSheetRows(rows).map(([c, list]) => [c, list.length])).toEqual([["teacher", 1], ["worker", 1]]);
  });
});
