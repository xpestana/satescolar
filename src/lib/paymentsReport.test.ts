import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTERS,
  compareInvoiceNumbers,
  filterPaymentRows,
  hasActiveFilters,
  pageCount,
  paginate,
  sortPaymentRows,
  summarizePaymentRows,
  type PaymentReportRow,
} from "./paymentsReport";
import { buildPaymentReportRows } from "./paymentsReportRows";

const row = (over: Partial<PaymentReportRow>): PaymentReportRow => ({
  id: over.id || Math.random().toString(36).slice(2),
  kind: "cuota",
  paymentId: "p1",
  invoiceNumber: "000100",
  controlNumber: "C-1",
  paymentDate: "2026-09-01",
  registeredAt: "2026-09-01T10:00:00Z",
  status: "completed",
  studentId: "s1",
  studentName: "Ana García",
  studentDocument: "V-30111222",
  familyName: "Flia. García",
  gradeLabel: "3er Año - A",
  planId: "plan-1",
  planName: "Plan Anual",
  conceptName: "Mes de Enero",
  conceptType: "mensualidad",
  conceptCurrency: "VES",
  originalAmount: null,
  amountVes: 1000,
  discountVes: 0,
  discountReason: "",
  exoneratedVes: 0,
  exonerationReason: "",
  isPartial: false,
  paymentTotalVes: 1000,
  methodIds: ["m1"],
  methodsLabel: "Transferencia",
  banks: "Banesco",
  references: "REF-9",
  paymentCurrencies: "VES",
  holderName: "María González",
  holderDocument: "V-15234567",
  observations: "",
  ...over,
});

describe("compareInvoiceNumbers", () => {
  it("ordena por valor numérico aunque tengan ceros a la izquierda", () => {
    expect(compareInvoiceNumbers("016836", "9836")).toBeGreaterThan(0);
    expect(compareInvoiceNumbers("000100", "000101")).toBeLessThan(0);
  });
  it("manda las vacías al final", () => {
    expect(compareInvoiceNumbers("", "000100")).toBeGreaterThan(0);
    expect(compareInvoiceNumbers("000100", "")).toBeLessThan(0);
  });
  it("cae a orden alfabético si no son numéricas", () => {
    expect(compareInvoiceNumbers("A-1", "B-1")).toBeLessThan(0);
  });
});

describe("sortPaymentRows", () => {
  const rows = [
    row({ id: "b", invoiceNumber: "000200", studentName: "Bruno Pérez", amountVes: 500 }),
    row({ id: "a", invoiceNumber: "000100", studentName: "Ana García", amountVes: 1500 }),
    row({ id: "c", invoiceNumber: "000150", studentName: "Álvaro Díaz", amountVes: 900 }),
  ];

  it("ordena por número de factura ascendente (orden por defecto)", () => {
    expect(sortPaymentRows(rows, "invoiceNumber", "asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
  });
  it("invierte con dirección descendente", () => {
    expect(sortPaymentRows(rows, "invoiceNumber", "desc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("ordena por nombre ignorando acentos", () => {
    expect(sortPaymentRows(rows, "studentName", "asc").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("ordena por monto", () => {
    expect(sortPaymentRows(rows, "amountVes", "asc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("no muta el arreglo original", () => {
    const original = rows.map((r) => r.id);
    sortPaymentRows(rows, "amountVes", "desc");
    expect(rows.map((r) => r.id)).toEqual(original);
  });
});

describe("filterPaymentRows", () => {
  const rows = [
    row({ id: "1", invoiceNumber: "000100", studentName: "Ana García", conceptType: "mensualidad", amountVes: 1000 }),
    row({ id: "2", invoiceNumber: "000101", studentName: "Bruno Pérez", familyName: "Flia. Pérez", conceptType: "inscripcion", amountVes: 5000, paymentDate: "2026-10-15", discountVes: 200, discountReason: "Media beca" }),
    row({ id: "3", invoiceNumber: "", kind: "exoneracion", studentName: "Carla Rojas", familyName: "Flia. Rojas", amountVes: 0, exoneratedVes: 800, exonerationReason: "Hijo de personal", status: "completed" }),
    row({ id: "4", invoiceNumber: "000102", studentName: "Diego Silva", familyName: "Flia. Silva", status: "voided", amountVes: 300 }),
  ];

  it("busca sin acentos y en cualquier campo", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, search: "garcia" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, search: "personal" }).map((r) => r.id)).toEqual(["3"]);
  });
  it("filtra por rango de fechas", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, dateFrom: "2026-10-01" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("filtra por estado y por tipo de línea", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, status: "voided" }).map((r) => r.id)).toEqual(["4"]);
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, kind: "exoneracion" }).map((r) => r.id)).toEqual(["3"]);
  });
  it("filtra por tipo de concepto y por rango de monto", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, conceptType: "inscripcion" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, minAmount: "1000" }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, maxAmount: "500" }).map((r) => r.id)).toEqual(["3", "4"]);
  });
  it("filtra solo con descuento / solo exoneradas", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, onlyDiscounts: true }).map((r) => r.id)).toEqual(["2"]);
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, onlyExonerations: true }).map((r) => r.id)).toEqual(["3"]);
  });
  it("sin filtros devuelve todo", () => {
    expect(filterPaymentRows(rows, EMPTY_FILTERS)).toHaveLength(4);
  });
});

describe("hasActiveFilters", () => {
  it("es falso con los filtros vacíos", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });
  it("es verdadero al tocar cualquiera", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: "ana" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, onlyPartial: true })).toBe(true);
  });
});

describe("summarizePaymentRows", () => {
  it("cuenta facturas distintas y suma montos, descuentos y exoneraciones", () => {
    const totals = summarizePaymentRows([
      row({ paymentId: "p1", amountVes: 1000, discountVes: 100 }),
      row({ paymentId: "p1", amountVes: 500 }),
      row({ paymentId: "p2", amountVes: 250, exoneratedVes: 800 }),
      row({ paymentId: null, kind: "exoneracion", amountVes: 0, exoneratedVes: 300 }),
    ]);
    expect(totals).toEqual({ rows: 4, payments: 2, amountVes: 1750, discountVes: 100, exoneratedVes: 1100 });
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 45 }, (_, i) => row({ id: String(i) }));
  it("pagina de 20 en 20", () => {
    expect(paginate(rows, 1)).toHaveLength(20);
    expect(paginate(rows, 3)).toHaveLength(5);
    expect(paginate(rows, 2)[0].id).toBe("20");
  });
  it("calcula el número de páginas, mínimo 1", () => {
    expect(pageCount(45)).toBe(3);
    expect(pageCount(0)).toBe(1);
  });
});

describe("buildPaymentReportRows", () => {
  const payments = [{
    id: "p1",
    invoice_number: "000100",
    control_number: "C-1",
    payment_date: "2026-09-01",
    created_at: "2026-09-01T10:00:00Z",
    status: "completed",
    total_amount_ves: 1200,
    invoice_name: "María González",
    invoice_rif: "V-15234567",
    observations: "",
    student_id: "s1",
    payment_method_entries: [
      { method: "m1", bank_name: "Banesco", reference_code: "REF-9", currency: "VES" },
      { method: "m1", bank_name: "Banesco", reference_code: "REF-9", currency: "VES" },
    ],
    payment_items: [{
      id: "i1", student_id: "s1", amount_ves: 1000, original_amount: null,
      discount_amount_ves: 200, discount_reason: "Ingresó a mitad de mes", is_partial: false,
      payment_plan_concepts: {
        plan_id: "plan-1", currency: "VES",
        payment_plans: { name: "Plan Anual" },
        payment_concepts: { name: "Mes de Enero", concept_type: "mensualidad" },
      },
    }],
    payment_others: [{ id: "o1", amount_ves: 200, notes: "Uniforme" }],
  }];

  const context = {
    studentNames: { s1: "Ana García" },
    studentDocuments: { s1: "V-30111222" },
    studentGrades: { s1: "3er Año - A" },
    studentFamilies: { s1: "Flia. García" },
    methodLabels: { m1: "Transferencia Bancaria" },
  };

  it("arma una fila por cuota y otra por 'Otros'", () => {
    const rows = buildPaymentReportRows(payments, [], context);
    expect(rows).toHaveLength(2);
    const cuota = rows[0];
    expect(cuota.kind).toBe("cuota");
    expect(cuota.studentName).toBe("Ana García");
    expect(cuota.planName).toBe("Plan Anual");
    expect(cuota.conceptName).toBe("Mes de Enero");
    expect(cuota.amountVes).toBe(1000);
    expect(cuota.discountVes).toBe(200);
    // Los métodos repetidos no se duplican en la etiqueta
    expect(cuota.methodsLabel).toBe("Transferencia Bancaria");
    expect(rows[1].kind).toBe("otros");
    expect(rows[1].conceptName).toBe("Uniforme");
  });

  it("suma la exoneración ligada a un pago con los datos de su factura", () => {
    const rows = buildPaymentReportRows(payments, [{
      id: "e1", payment_id: "p1", student_id: "s1", amount_ves: 500, original_amount: null,
      currency: "VES", reason: "Hijo de personal", created_at: "2026-09-02T10:00:00Z",
      payment_plan_concepts: {
        plan_id: "plan-1",
        payment_plans: { name: "Plan Anual" },
        payment_concepts: { name: "Mes de Febrero", concept_type: "mensualidad" },
      },
    }], context);
    const exoneracion = rows.find((r) => r.kind === "exoneracion")!;
    expect(exoneracion.invoiceNumber).toBe("000100");
    expect(exoneracion.exoneratedVes).toBe(500);
    expect(exoneracion.amountVes).toBe(0);
    expect(exoneracion.exonerationReason).toBe("Hijo de personal");
  });

  it("una exoneración sin pago usa su propia fecha y queda sin factura", () => {
    const rows = buildPaymentReportRows([], [{
      id: "e2", payment_id: null, student_id: "s1", amount_ves: 300,
      currency: "VES", reason: "Beca", created_at: "2026-10-05T12:00:00Z",
      payment_plan_concepts: { payment_concepts: { name: "Mes de Marzo", concept_type: "mensualidad" } },
    }], context);
    expect(rows[0].invoiceNumber).toBe("");
    expect(rows[0].paymentDate).toBe("2026-10-05");
    expect(rows[0].paymentId).toBeNull();
  });
});
