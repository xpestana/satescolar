import { describe, expect, it } from "vitest";
import { buildPayrollSheetAoa, buildPayrollSheetRows, groupSheetRows, type SheetPaymentInput } from "./payrollSheet";

const salary = { name: "Sueldo base", is_base_salary: true };

const worker = (name: string, overrides: Partial<SheetPaymentInput> = {}): SheetPaymentInput => ({
  status: "paid",
  currency: "USD",
  exchange_rate: 412.5617,
  payment_reference: "123456",
  beneficiary: { full_name: name, document_id: "V-1", hire_date: "2020-01-07", job_title: "Mantenimiento", category: "worker" },
  items: [
    { concept_kind: "earning", amount: 2, amount_ves: 825.12, withholding_id: null, contribution_kind: null, concept: salary },
    { concept_kind: "deduction", amount: 0.0727, amount_ves: 30, withholding_id: null, contribution_kind: "ivss" },
    { concept_kind: "deduction", amount: 0.02, amount_ves: 8.25, withholding_id: null, contribution_kind: "faov" },
    { concept_kind: "deduction", amount: 0.0115, amount_ves: 4.76, withholding_id: null, contribution_kind: "rpe" },
  ],
  ...overrides,
});

const heading = { schoolName: "Colegio", schoolRif: "J-1", periodName: "2da quincena", periodStart: "2026-11-16", periodEnd: "2026-11-30" };

describe("planilla de nómina", () => {
  it("arma una fila por trabajador en bolívares", () => {
    const [row] = buildPayrollSheetRows([worker("Ana")]);
    expect(row).toMatchObject({
      hireDate: "07/01/2020",
      jobTitle: "Mantenimiento",
      salaryUsd: 2,
      rate: 412.5617,
      baseVes: 825.12,
      otherEarnings: {},
      grossVes: 825.12,
      ivss: 30,
      faov: 8.25,
      rpe: 4.76,
      unpaidHoursVes: 0,
      islr: 0,
      otherDeductions: 0,
      totalDeductions: 43.01,
      netVes: 782.11,
      reference: "123456",
    });
  });

  it("separa sueldo base, bono, cesta ticket, permiso, ISLR y otros descuentos", () => {
    const payment = worker("Ana");
    payment.items.push(
      { concept_kind: "earning", amount: 10, amount_ves: 4125.62, withholding_id: null, contribution_kind: null, concept: { name: "Bono", is_base_salary: false } },
      { concept_kind: "earning", amount: 40, amount_ves: 16502.47, withholding_id: null, contribution_kind: null, concept: { name: "Cesta ticket", is_base_salary: false } },
      { concept_kind: "deduction", amount: 0.05, amount_ves: 15.47, withholding_id: null, contribution_kind: null, unpaid_hours: 3 },
      { concept_kind: "deduction", amount: 0.05, amount_ves: 20.63, withholding_id: "w1", contribution_kind: null },
      { concept_kind: "deduction", amount: 0.1, amount_ves: 41.26, withholding_id: null, contribution_kind: null }
    );
    const [row] = buildPayrollSheetRows([payment]);
    expect(row.salaryUsd).toBe(2);
    expect(row.baseVes).toBe(825.12);
    expect(row.otherEarnings).toEqual({ Bono: 4125.62, "Cesta ticket": 16502.47 });
    expect(row.grossVes).toBe(21453.21);
    expect(row.unpaidHours).toBe(3);
    expect(row.unpaidHoursVes).toBe(15.47);
    expect(row.islr).toBe(20.63);
    expect(row.otherDeductions).toBe(41.26);
    expect(row.netVes).toBe(21453.21 - 120.37);

    const aoa = buildPayrollSheetAoa(heading, "worker", [row]);
    expect(aoa[6]).toEqual([
      "Nombres y Apellidos", "Cédula", "Fecha de ingreso", "Cargo", "Sueldo mensual ($)", "Tasa",
      "Total sueldo mensual Bs.", "Bono Bs.", "Cesta ticket Bs.", "Total asignaciones Bs.",
      "IVSS", "FAOV", "R.P.E. (paro forzoso)", "Permiso no justificado", "Retención ISLR", "Otros descuentos",
      "Total descuento", "Total a pagar", "Referencia",
    ]);
  });

  it("los totales suman todas las filas y deja fuera los anulados", () => {
    const rows = buildPayrollSheetRows([worker("Beto"), worker("Ana"), worker("Carla", { status: "voided" })]);
    expect(rows.map((r) => r.name)).toEqual(["Ana", "Beto"]);
    const aoa = buildPayrollSheetAoa(heading, "worker", rows);
    expect(aoa[3]).toEqual(["DEL 16/11/2026 AL 30/11/2026"]);
    expect(aoa[4]).toEqual(["NÓMINA OBRERO"]);
    const totals = aoa[aoa.length - 1];
    expect(totals[0]).toBe("TOTALES");
    // Sueldo $, tasa, sueldo Bs, IVSS, FAOV, RPE, permiso, ISLR, otros, total desc, total a pagar
    expect(totals.slice(4, 17)).toEqual([4, "", 1650.24, 60, 16.5, 9.52, 0, 0, 0, 86.02, 1564.22, ""].slice(0, 13));
  });

  it("sin línea marcada como sueldo base, todo lo asignado cuenta como sueldo", () => {
    const old = worker("Ana", {
      items: [{ concept_kind: "earning", amount: 2, amount_ves: null, withholding_id: null, contribution_kind: null }],
    });
    const inVes = worker("Beto", {
      currency: "VES",
      exchange_rate: 1,
      items: [{ concept_kind: "earning", amount: 1000, amount_ves: null, withholding_id: null, contribution_kind: null }],
    });
    const [a, b] = buildPayrollSheetRows([old, inVes]);
    expect(a).toMatchObject({ baseVes: 825.12, salaryUsd: 2, otherEarnings: {} });
    expect(b).toMatchObject({ baseVes: 1000, grossVes: 1000, salaryUsd: null, rate: null });
  });

  it("agrupa por categoría", () => {
    const rows = buildPayrollSheetRows([
      worker("Ana"),
      worker("Doc", { beneficiary: { full_name: "Doc", document_id: null, hire_date: null, job_title: null, category: "teacher" } }),
    ]);
    expect(groupSheetRows(rows).map(([c, list]) => [c, list.length])).toEqual([["teacher", 1], ["worker", 1]]);
  });
});
