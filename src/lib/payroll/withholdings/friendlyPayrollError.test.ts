import { describe, expect, it } from "vitest";
import { parsePayrollError } from "./friendlyPayrollError";

describe("parsePayrollError", () => {
  it("splits the code from an RPC message", () => {
    expect(parsePayrollError({ message: "WITHHOLDING_RATE_CHANGED: recalcule el pago" })).toEqual({
      code: "WITHHOLDING_RATE_CHANGED",
      message: "Recalcule el pago",
    });
  });

  it("explains each duplicate by its index", () => {
    const duplicate = (message: string) => parsePayrollError({ code: "23505", message });
    expect(duplicate('violates "payroll_purchase_documents_uq"').message).toMatch(/factura/);
    expect(duplicate('violates "payroll_beneficiaries_school_tax_id_uq"').message).toMatch(/RIF/);
    expect(duplicate('violates "payroll_payments_period_beneficiary_uq"').message).toMatch(/período/);
    expect(duplicate('violates "payroll_withholdings_voucher_uq"').message).toMatch(/consecutivo/);
  });

  it("falls back to the raw message or a generic one", () => {
    expect(parsePayrollError({ message: "algo falló" })).toEqual({ code: null, message: "algo falló" });
    expect(parsePayrollError(null).message).toMatch(/No se pudo/);
  });
});
