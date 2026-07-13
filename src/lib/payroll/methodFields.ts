// Which config fields each payment method type collects, and a helper to extract
// the non-empty labeled values from a stored method. Shared by the methods editor,
// the method-details view and the registration table.

import type { PayrollMethodType } from "./types";

export const METHOD_FIELDS: Record<PayrollMethodType, { key: string; label: string }[]> = {
  transfer: [
    { key: "bank_name", label: "Banco" },
    { key: "account_number", label: "N° de cuenta" },
    { key: "account_holder", label: "Titular" },
  ],
  mobile_payment: [
    { key: "bank_name", label: "Banco" },
    { key: "phone", label: "Teléfono" },
    { key: "document_id", label: "Cédula/RIF" },
  ],
  cash: [],
  check: [{ key: "bank_name", label: "Banco" }],
};

export interface LabeledValue {
  label: string;
  value: string;
}

/** Non-empty labeled values of a method's config, in field order. */
export function methodLabeledValues(method: {
  method_type: PayrollMethodType;
  config: Record<string, unknown> | null | undefined;
}): LabeledValue[] {
  const fields = METHOD_FIELDS[method.method_type] ?? [];
  return fields
    .map((f) => ({ label: f.label, value: String(method.config?.[f.key] ?? "").trim() }))
    .filter((x) => x.value.length > 0);
}
