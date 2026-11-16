import { describe, expect, it } from "vitest";
import { buildSalaryReceipt, renderReceiptText, type SalaryReceiptInput } from "./salaryReceipt";

const base: SalaryReceiptInput = {
  school: { name: "U.E. Colegio Uno C.A.", address: "Av. Principal, Valencia", rif: "J-00000000-1", phone: "0241-0000000" },
  beneficiary: { name: "Ana Pérez", documentId: "V-12.345.678", category: "teacher", hireDate: "2025-09-15", jobTitle: "Docente de aula" },
  period: { name: "Segunda quincena agosto año 2026", start: "2026-08-16", end: "2026-08-31", type: "biweekly" },
  method: { type: "transfer", config: { bank_name: "Banco Uno", account_number: "0000-1111-22-3333333333" } },
  currency: "VES",
  exchangeRate: 1,
  lines: [
    {
      concept_kind: "earning",
      description: "Sueldo base",
      amount: 250,
      is_base_salary: true,
      receipt_text: "Días de descanso | {dias}\nValor del día | {valor_dia}\nTotal días de descanso | | {monto}",
    },
    { concept_kind: "earning", description: "Bono", amount: 40 },
    { concept_kind: "deduction", description: "SSO 4 % (5 lunes)", amount: 23.08, contribution_kind: "ivss" },
    { concept_kind: "deduction", description: "RPE 0,5 % (5 lunes)", amount: 2.88, contribution_kind: "rpe" },
    { concept_kind: "deduction", description: "FAOV 1 %", amount: 5, contribution_kind: "faov" },
    { concept_kind: "deduction", description: "Caja de ahorro", amount: 10, concept_receipt_text: "Caja de ahorro | | {monto}" },
  ],
  notes: "Vacaciones colectivas del 16 al 31.",
  contributionsEnabled: true,
  islrEnabled: true,
};

describe("salary receipt", () => {
  it("fills the header and the worker grid", () => {
    const r = buildSalaryReceipt(base);
    expect(r).toMatchObject({
      payrollLabel: "NÓMINA EMPLEADOS",
      workerName: "ANA PÉREZ",
      hireDate: "15/09/2025",
      periodRange: "16.08 AL 31.08.2026",
      periodRangeSlash: "16/08 AL 31/08/2026",
      periodName: "SEGUNDA QUINCENA AGOSTO AÑO 2026",
      bankText: "BCO. UNO CTA N° 0000-1111-22-3333333333",
      monthlySalary: "500,00",
      notes: "Vacaciones colectivas del 16 al 31.",
    });
    expect(buildSalaryReceipt({ ...base, beneficiary: { ...base.beneficiary, category: "worker" } }).payrollLabel).toBe("NÓMINA OBREROS");
  });

  it("prints a concept with its receipt text and variables", () => {
    const r = buildSalaryReceipt(base);
    expect(r.earnings).toEqual([
      { label: "Días de descanso", detail: "15", amount: "" },
      { label: "Valor del día", detail: "16,67", amount: "" },
      { label: "Total días de descanso", detail: "", amount: "250,00" },
      { label: "Bono", detail: "", amount: "40,00" },
    ]);
  });

  it("always lists the legal deductions first, even at 0,00", () => {
    const r = buildSalaryReceipt(base);
    expect(r.deductions).toEqual([
      { label: "SSO", detail: "", amount: "23,08" },
      { label: "RPE", detail: "", amount: "2,88" },
      { label: "FAOV", detail: "", amount: "5,00" },
      { label: "FALTAS", detail: "", amount: "0,00" },
      { label: "RETENCIÓN ISLR %", detail: "", amount: "0,00" },
      { label: "Caja de ahorro", detail: "", amount: "10,00" },
    ]);
    expect(r.grossVes).toBe("290,00");
    expect(r.deductionsVes).toBe("40,96");
    expect(r.netVes).toBe("249,04");
  });

  it("shows absences and the AR-I percentage", () => {
    const r = buildSalaryReceipt({
      ...base,
      lines: [
        base.lines[0],
        { concept_kind: "deduction", description: "Permiso no justificado (3 h)", amount: 9.38, unpaid_hours: 3 },
        { concept_kind: "deduction", description: "Retención ISLR (AR-I 1,5 %)", amount: 3.75, islr_pct: 1.5 },
      ],
    });
    expect(r.deductions).toContainEqual({ label: "FALTAS", detail: "3 h", amount: "9,38" });
    expect(r.deductions).toContainEqual({ label: "RETENCIÓN ISLR 1,5 %", detail: "", amount: "3,75" });
  });

  it("hides parafiscales and ISLR rows when the school doesn't deduct them", () => {
    const r = buildSalaryReceipt({ ...base, contributionsEnabled: false, islrEnabled: false, lines: [base.lines[0]] });
    expect(r.deductions.map((d) => d.label)).toEqual(["FALTAS"]);
  });

  it("prints a payment in dollars with the bolívares of each line", () => {
    const r = buildSalaryReceipt({
      ...base,
      currency: "USD",
      exchangeRate: 400,
      lines: [
        { concept_kind: "earning", description: "Sueldo base", amount: 1.25, amount_ves: 500, is_base_salary: true },
        { concept_kind: "deduction", description: "FAOV", amount: 0.025, amount_ves: 10, contribution_kind: "faov" },
      ],
    });
    expect(r.earnings[0].amount).toBe("500,00");
    expect(r.monthlySalary).toBe("1.000,00");
    expect(r.netVes).toBe("490,00");
  });

  it("prefers the payment's own text over the concept's", () => {
    const r = buildSalaryReceipt({
      ...base,
      lines: [{ ...base.lines[0], receipt_text: "Días normales trabajados | 0", concept_receipt_text: "No | usar" }],
    });
    expect(r.earnings).toEqual([{ label: "Días normales trabajados", detail: "0", amount: "" }]);
  });

  it("leaves unknown variables as written and skips empty lines", () => {
    expect(renderReceiptText("A | {otra}\n\n  B | {monto}  ", { monto: "1,00" })).toEqual([
      { label: "A", detail: "{otra}", amount: "" },
      { label: "B", detail: "1,00", amount: "" },
    ]);
  });

  it("describes other payment methods", () => {
    const mobile = buildSalaryReceipt({ ...base, method: { type: "mobile_payment", config: { bank_name: "Banco Dos", phone: "0414-0000000" } } });
    expect(mobile.bankText).toBe("PAGO MÓVIL BANCO DOS 0414-0000000");
    expect(buildSalaryReceipt({ ...base, method: null }).bankText).toBe("");
  });
});
