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
  type PaymentReportLine,
  type PaymentReportRow,
} from "./paymentsReport";
import { buildPaymentReportRows } from "./paymentsReportRows";

const line = (over: Partial<PaymentReportLine> = {}): PaymentReportLine => ({
  id: over.id || Math.random().toString(36).slice(2),
  kind: "cuota",
  studentId: "s1",
  studentName: "Ana García",
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
  ...over,
});

const row = (over: Partial<PaymentReportRow> = {}): PaymentReportRow => {
  const lines = over.lines || [line()];
  return {
    id: over.id || Math.random().toString(36).slice(2),
    paymentId: "p1",
    invoiceNumber: "000100",
    controlNumber: "00-000100",
    paymentDate: "2026-09-01",
    registeredAt: "2026-09-01T10:00:00Z",
    status: "completed",
    studentNames: ["Ana García"],
    studentsLabel: "Ana García",
    studentDocuments: "V-30111222",
    gradesLabel: "3er Año - A",
    familyName: "Flia. García",
    planIds: ["plan-1"],
    plansLabel: "Plan Anual",
    conceptTypes: ["mensualidad"],
    conceptCurrencies: ["VES"],
    conceptsLabel: "Mes de Enero",
    amountVes: 1000,
    paymentTotalVes: 1000,
    discountVes: 0,
    exoneratedVes: 0,
    hasPartial: false,
    methodIds: ["m1"],
    methodsLabel: "Transferencia",
    banks: "Banesco",
    references: "REF-9",
    paymentCurrencies: "VES",
    holderName: "María González",
    holderDocument: "V-15234567",
    observations: "",
    ...over,
    lines,
  };
};

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
    row({ id: "b", invoiceNumber: "000200", studentsLabel: "Bruno Pérez", amountVes: 500 }),
    row({ id: "a", invoiceNumber: "000100", studentsLabel: "Ana García", amountVes: 1500 }),
    row({ id: "c", invoiceNumber: "000150", studentsLabel: "Álvaro Díaz", amountVes: 900 }),
  ];

  it("ordena por número de factura ascendente (orden por defecto)", () => {
    expect(sortPaymentRows(rows, "invoiceNumber", "asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
  });
  it("invierte con dirección descendente", () => {
    expect(sortPaymentRows(rows, "invoiceNumber", "desc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("ordena por estudiante ignorando acentos", () => {
    expect(sortPaymentRows(rows, "studentsLabel", "asc").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("ordena por monto cobrado", () => {
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
    row({ id: "1", invoiceNumber: "000100", studentsLabel: "Ana García", familyName: "Flia. García", conceptTypes: ["mensualidad"], amountVes: 1000 }),
    row({
      id: "2", invoiceNumber: "000101", studentsLabel: "Bruno Pérez", familyName: "Flia. Pérez",
      conceptTypes: ["inscripcion"], amountVes: 5000, paymentDate: "2026-10-15", discountVes: 200,
      lines: [line({ conceptType: "inscripcion", discountVes: 200, discountReason: "Media beca" })],
    }),
    row({
      id: "3", invoiceNumber: "", paymentId: null, studentsLabel: "Carla Rojas", familyName: "Flia. Rojas",
      amountVes: 0, exoneratedVes: 800,
      lines: [line({ kind: "exoneracion", amountVes: 0, exoneratedVes: 800, exonerationReason: "Hijo de personal" })],
    }),
    row({ id: "4", invoiceNumber: "000102", studentsLabel: "Diego Silva", familyName: "Flia. Silva", status: "voided", amountVes: 300 }),
  ];

  it("busca sin acentos y en cualquier campo, incluido el detalle", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, search: "garcia" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, search: "personal" }).map((r) => r.id)).toEqual(["3"]);
  });
  it("filtra por rango de fechas", () => {
    expect(filterPaymentRows(rows, { ...EMPTY_FILTERS, dateFrom: "2026-10-01" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("filtra por estado y por tipo de línea presente en la factura", () => {
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
  it("cuenta facturas y conceptos, y suma montos, descuentos y exoneraciones", () => {
    const totals = summarizePaymentRows([
      row({ amountVes: 1500, discountVes: 100, lines: [line({ amountVes: 1000, discountVes: 100 }), line({ amountVes: 500 })] }),
      row({ amountVes: 250, exoneratedVes: 800, lines: [line({ amountVes: 250 }), line({ kind: "exoneracion", amountVes: 0, exoneratedVes: 800 })] }),
    ]);
    expect(totals).toEqual({ payments: 2, lines: 4, amountVes: 1750, discountVes: 100, exoneratedVes: 800 });
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
  // Caso real: una sola factura familiar que cubre cuotas de tres hermanos
  const familyPayment = {
    id: "p1",
    invoice_number: "016397",
    control_number: "00-016497",
    payment_date: "2025-10-15",
    created_at: "2025-10-15T10:00:00Z",
    status: "completed",
    total_amount_ves: 27876,
    invoice_name: "MILLY TERESITA ALBORNOZ RAMIREZ",
    invoice_rif: "V-16307134",
    observations: "",
    student_id: null,
    payment_method_entries: [
      { method: "m1", bank_name: "PROVINCIAL", reference_code: "REF-1", currency: "VES" },
    ],
    payment_items: [
      {
        id: "i1", student_id: "s1", amount_ves: 14933.57, original_amount: null,
        discount_amount_ves: 0, is_partial: false,
        payment_plan_concepts: {
          plan_id: "plan-1", currency: "VES",
          payment_plans: { name: "Plan Anual" },
          payment_concepts: { name: "Matricula INS", concept_type: "inscripcion" },
        },
      },
      {
        id: "i2", student_id: "s2", amount_ves: 4977.86, original_amount: null,
        discount_amount_ves: 0, is_partial: false,
        payment_plan_concepts: {
          plan_id: "plan-1", currency: "VES",
          payment_plans: { name: "Plan Anual" },
          payment_concepts: { name: "Matricula INS", concept_type: "inscripcion" },
        },
      },
      {
        id: "i3", student_id: "s3", amount_ves: 7964.57, original_amount: null,
        discount_amount_ves: 0, is_partial: true,
        payment_plan_concepts: {
          plan_id: "plan-1", currency: "VES",
          payment_plans: { name: "Plan Anual" },
          payment_concepts: { name: "Mes de Septiembre", concept_type: "mensualidad" },
        },
      },
    ],
    payment_others: [],
  };

  const context = {
    studentNames: { s1: "SARA BEATRIZ LEAL", s2: "MILLY ANDREA LEAL", s3: "JUAN ANDRES LEAL" },
    studentDocuments: { s1: "V-34856282", s2: "V-34075293", s3: "V-34075282" },
    studentGrades: { s1: "2do Año - U", s2: "3er Año - U", s3: "4to Año - U" },
    studentFamilies: { s1: "ALBORNOZ RAMIREZ", s2: "ALBORNOZ RAMIREZ", s3: "ALBORNOZ RAMIREZ" },
    methodLabels: { m1: "Transferencia Bancaria" },
  };

  it("una factura familiar con 3 hijos es UNA fila con 3 líneas", () => {
    const rows = buildPaymentReportRows([familyPayment], [], context);
    expect(rows).toHaveLength(1);
    const invoice = rows[0];
    expect(invoice.invoiceNumber).toBe("016397");
    expect(invoice.lines).toHaveLength(3);
    expect(invoice.studentNames).toEqual(["SARA BEATRIZ LEAL", "MILLY ANDREA LEAL", "JUAN ANDRES LEAL"]);
    expect(invoice.conceptsLabel).toBe("Matricula INS, Mes de Septiembre");
    expect(invoice.gradesLabel).toBe("2do Año - U · 3er Año - U · 4to Año - U");
    expect(invoice.familyName).toBe("ALBORNOZ RAMIREZ");
    expect(invoice.amountVes).toBe(27876);
    expect(invoice.paymentTotalVes).toBe(27876);
    expect(invoice.hasPartial).toBe(true);
    // Los métodos repetidos no se duplican en la etiqueta
    expect(invoice.methodsLabel).toBe("Transferencia Bancaria");
  });

  it("suma 'Otros' y la exoneración aplicada en esa misma factura", () => {
    const rows = buildPaymentReportRows(
      [{ ...familyPayment, payment_others: [{ id: "o1", amount_ves: 200, notes: "Uniforme" }] }],
      [{
        id: "e1", payment_id: "p1", student_id: "s2", amount_ves: 500, original_amount: null,
        currency: "VES", reason: "Hijo de personal", created_at: "2025-10-15T11:00:00Z",
        payment_plan_concepts: { payment_concepts: { name: "Mes de Octubre", concept_type: "mensualidad" } },
      }],
      context,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].lines).toHaveLength(5);
    expect(rows[0].exoneratedVes).toBe(500);
    expect(rows[0].amountVes).toBe(28076);
    expect(rows[0].lines.map((l) => l.kind)).toEqual(["cuota", "cuota", "cuota", "otros", "exoneracion"]);
  });

  it("una exoneración sin factura es su propia fila, con su fecha", () => {
    const rows = buildPaymentReportRows([], [{
      id: "e2", payment_id: null, student_id: "s1", amount_ves: 300,
      currency: "VES", reason: "Beca", created_at: "2025-10-05T12:00:00Z",
      payment_plan_concepts: { payment_concepts: { name: "Mes de Marzo", concept_type: "mensualidad" } },
    }], context);
    expect(rows).toHaveLength(1);
    expect(rows[0].paymentId).toBeNull();
    expect(rows[0].invoiceNumber).toBe("");
    expect(rows[0].paymentDate).toBe("2025-10-05");
    expect(rows[0].exoneratedVes).toBe(300);
  });
});
