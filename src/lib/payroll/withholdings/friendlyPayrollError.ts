// Payroll RPCs raise `CODE: mensaje`. This keeps the message for the user and the code for logic.

export interface PayrollError {
  code: string | null;
  message: string;
}

interface RawError {
  code?: string;
  message?: string;
}

export function parsePayrollError(error: RawError | null | undefined): PayrollError {
  const raw = error?.message ?? "";

  if (error?.code === "23505") {
    if (raw.includes("payroll_purchase_documents_uq")) {
      return { code: "DUPLICATE_DOCUMENT", message: "Esa factura ya está registrada para este proveedor." };
    }
    if (raw.includes("payroll_beneficiaries_school_tax_id_uq")) {
      return { code: "DUPLICATE_TAX_ID", message: "Ya existe un beneficiario con ese RIF en este colegio." };
    }
    if (raw.includes("payroll_beneficiaries_school_document_uq")) {
      return { code: "DUPLICATE_DOCUMENT_ID", message: "Ya existe un beneficiario con esa cédula en este colegio." };
    }
    if (raw.includes("payroll_payments_period_beneficiary_uq")) {
      return { code: "DUPLICATE_PAYMENT", message: "Este beneficiario ya tiene un pago en este período." };
    }
    if (raw.includes("payroll_withholdings_voucher_uq")) {
      return {
        code: "DUPLICATE_VOUCHER",
        message: "El número de comprobante ya existe. Revise el consecutivo en la configuración de retenciones.",
      };
    }
    return { code: "DUPLICATE", message: "Ya existe un registro con esos datos." };
  }

  const match = raw.match(/^([A-Z_]+):\s*(.+)$/s);
  if (match) return { code: match[1], message: match[2].charAt(0).toUpperCase() + match[2].slice(1) };
  return { code: null, message: raw || "No se pudo completar la operación" };
}

export function toPayrollError(error: RawError | null | undefined): Error & { code: string | null } {
  const parsed = parsePayrollError(error);
  return Object.assign(new Error(parsed.message), { code: parsed.code });
}
