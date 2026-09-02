export type MethodOptionLike = {
  value: string;
  config?: Record<string, any> | null;
};

/** Nombre del banco configurado en el método de pago del colegio (vacío si no tiene). */
export function bankNameForMethod(options: MethodOptionLike[], methodValue: string): string {
  const cfg = options.find((o) => o.value === methodValue)?.config;
  const bank = cfg?.bank_name;
  return typeof bank === "string" ? bank.trim() : "";
}

/**
 * Banco resultante al cambiar el método de un pago: autocompleta con el banco
 * configurado en el método seleccionado, pero respeta lo que el usuario haya
 * escrito a mano (solo sobrescribe si el campo está vacío o si conserva el
 * banco autocompletado del método anterior).
 */
export function resolveBankOnMethodChange(
  options: MethodOptionLike[],
  prevMethod: string,
  nextMethod: string,
  currentBank: string,
): string {
  const current = (currentBank || "").trim();
  const prevAuto = bankNameForMethod(options, prevMethod);
  if (current && current !== prevAuto) return currentBank;
  return bankNameForMethod(options, nextMethod);
}
