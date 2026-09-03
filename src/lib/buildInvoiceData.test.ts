import { describe, it, expect } from "vitest";
import { buildInvoiceData, MAX_INVOICE_STUDENTS, invoiceStudentKeys } from "./buildInvoiceData";

const methodLabel = (raw: string) => (raw === "m1" ? "Transferencia Bancaria" : raw);

const payment = {
  payment_date: "2026-09-11",
  invoice_number: "016725",
  control_number: "00-00016725",
  invoice_name: "María González",
  invoice_rif: "V-15234567",
  total_amount_ves: 8000,
  payment_items: [
    {
      amount_ves: 5000,
      discount_amount_ves: 0,
      payment_plan_concepts: {
        concept_id: "c1",
        payment_concepts: { id: "c1", name: "Mes de Septiembre" },
      },
    },
  ],
  payment_method_entries: [{ method: "m1", reference_code: "REF-9" }],
};

describe("buildInvoiceData", () => {
  it("marca los conceptos pagados y expone su monto", () => {
    const data = buildInvoiceData(payment, "Ana González", "3_ano", "A", methodLabel);
    expect(data["concept:c1"]).toBe("✓");
    expect(data["concept:c1#amount"]).toBe("5.000,00");
    expect(data.total_amount).toBe("8.000,00");
    expect(data.payment_method_text).toBe("Transferencia Bancaria (Ref: REF-9)");
  });

  it("traduce el grado del enum a su etiqueta", () => {
    const data = buildInvoiceData(payment, "Ana González", "3_ano", "A", methodLabel);
    expect(data.student_grade).toBe("3er Año");
    expect(data.student_section).toBe("A");
  });

  it("sin lista de estudiantes, llena el bloque 1 con el estudiante suelto", () => {
    const data = buildInvoiceData(payment, "Ana González", "3_ano", "A", methodLabel);
    const keys = invoiceStudentKeys(1);
    expect(data[keys.name]).toBe("Ana González");
    expect(data[keys.grade]).toBe("3er Año");
    expect(data[keys.section]).toBe("A");
    expect(data[invoiceStudentKeys(2).name]).toBeUndefined();
  });

  it("con varios hijos, cada uno lleva su propio grado y sección", () => {
    const data = buildInvoiceData(payment, "Ana / Luis", "3_ano", "A", methodLabel, [
      { name: "Ana González", gradeLevel: "3_ano", sectionName: "A" },
      { name: "Luis González", gradeLevel: "1_ano", sectionName: "B" },
      { name: "Sofía González", gradeLevel: "6_grado", sectionName: "U" },
    ]);
    expect(data[invoiceStudentKeys(1).name]).toBe("Ana González");
    expect(data[invoiceStudentKeys(1).section]).toBe("A");
    expect(data[invoiceStudentKeys(2).name]).toBe("Luis González");
    expect(data[invoiceStudentKeys(2).grade]).toBe("1er Año");
    expect(data[invoiceStudentKeys(2).section]).toBe("B");
    expect(data[invoiceStudentKeys(3).grade]).toBe("6to Grado");
    // El campo "todos en una línea" sigue existiendo para las plantillas ya diseñadas
    expect(data.student_name).toBe("Ana / Luis");
  });

  it("ignora los estudiantes que exceden el máximo configurable", () => {
    const many = Array.from({ length: MAX_INVOICE_STUDENTS + 2 }, (_, i) => ({
      name: `Hijo ${i + 1}`, gradeLevel: "1_ano", sectionName: "A",
    }));
    const data = buildInvoiceData(payment, "Varios", "", "", methodLabel, many);
    expect(data[invoiceStudentKeys(MAX_INVOICE_STUDENTS).name]).toBe(`Hijo ${MAX_INVOICE_STUDENTS}`);
    expect(data[invoiceStudentKeys(MAX_INVOICE_STUDENTS + 1).name]).toBeUndefined();
  });

  it("deja vacíos los datos que no tiene, para que el overlay no los imprima", () => {
    const data = buildInvoiceData(payment, "Ana", "", "", methodLabel, [
      { name: "Ana González", gradeLevel: "", sectionName: "" },
    ]);
    expect(data[invoiceStudentKeys(1).grade]).toBe("");
    expect(data[invoiceStudentKeys(1).section]).toBe("");
  });

  it("expone el descuento solo cuando lo hubo", () => {
    expect(buildInvoiceData(payment, "Ana", "", "", methodLabel).total_discount).toBe("");
    const withDiscount = buildInvoiceData(
      { ...payment, payment_items: [{ ...payment.payment_items[0], discount_amount_ves: 2500, discount_reason: "Media beca" }] },
      "Ana", "", "", methodLabel,
    );
    expect(withDiscount.total_discount).toBe("2.500,00");
    expect(withDiscount.discount_reason).toBe("Media beca");
  });
});
