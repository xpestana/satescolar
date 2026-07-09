import { describe, expect, it } from "vitest";
import {
  buildPayrollReceiptData,
  formatMoney,
  type PayrollReceiptInput,
} from "./buildPayrollReceiptData";

const baseInput: PayrollReceiptInput = {
  schoolName: "Colegio Demo",
  beneficiaryName: "Juan Pérez",
  documentId: "V-12345678",
  category: "teacher",
  periodName: "Julio 2026",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  currency: "VES",
  exchangeRate: 1,
  items: [
    { concept_kind: "earning", description: "Sueldo base", amount: 1000 },
    { concept_kind: "earning", description: "Bono", amount: 200 },
    { concept_kind: "deduction", description: "Retención", amount: 100 },
  ],
  methodType: "transfer",
  methodLabel: "Banesco 0134",
  paymentDate: "2026-07-31",
  notes: "  ",
};

describe("buildPayrollReceiptData", () => {
  it("mapea totales, categoría y método legibles", () => {
    const data = buildPayrollReceiptData(baseInput);
    expect(data.categoryLabel).toBe("Docente");
    expect(data.grossFormatted).toBe("VES 1.200,00");
    expect(data.deductionsFormatted).toBe("VES 100,00");
    expect(data.netFormatted).toBe("VES 1.100,00");
    expect(data.earnings).toHaveLength(2);
    expect(data.deductions).toHaveLength(1);
    expect(data.methodLabel).toBe("Banesco 0134");
    expect(data.notes).toBe("");
  });

  it("convierte el neto a VES cuando la moneda es USD", () => {
    const data = buildPayrollReceiptData({ ...baseInput, currency: "USD", exchangeRate: 40 });
    expect(data.netFormatted).toBe("USD 1.100,00");
    expect(data.netVesFormatted).toBe("VES 44.000,00");
    expect(data.exchangeRateFormatted).toBe("40,00");
  });

  it("cae en el label por defecto del método cuando no hay label", () => {
    const data = buildPayrollReceiptData({ ...baseInput, methodLabel: null, methodType: "cash" });
    expect(data.methodLabel).toBe("Efectivo");
  });

  it("usa guiones para campos faltantes", () => {
    const data = buildPayrollReceiptData({
      ...baseInput,
      documentId: null,
      methodType: null,
      paymentDate: null,
    });
    expect(data.documentId).toBe("—");
    expect(data.methodLabel).toBe("—");
    expect(data.paymentDateFormatted).toBe("—");
  });
});

describe("formatMoney", () => {
  it("formatea con separadores es-VE y código de moneda", () => {
    expect(formatMoney(1234567.5, "VES")).toBe("VES 1.234.567,50");
    expect(formatMoney(0, "USD")).toBe("USD 0,00");
    expect(formatMoney(NaN, "VES")).toBe("VES 0,00");
  });
});
