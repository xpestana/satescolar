/** Repara eñes descompuestas (n/N + tilde combinante) antes de normalizar. */
export function repairSpanishEnye(text: string): string {
  return text.replace(/(n|N)\u0303/g, (_, letter: string) =>
    letter === "N" ? "Ñ" : "ñ",
  );
}

/** Mayusculiza texto de planilla respetando Ñ (locale es-VE) cuando spanish=true. */
export function formatPlanillaStudentText(
  text: string,
  useSpanishNames: boolean,
): string {
  let s = String(text ?? "").trim();
  if (!s) return "";
  s = repairSpanishEnye(s).normalize("NFC");
  if (useSpanishNames) {
    return s.toLocaleUpperCase("es-VE");
  }
  return s.toUpperCase();
}

/**
 * Relleno de las casillas vacías del Resumen Final (fila sin estudiante o dato sin registrar),
 * según el ancho de cada campo. Igual en primaria y en bachillerato 31059/31060.
 */
export const PLANILLA_EMPTY = {
  /** Cédula, lugar de nacimiento, apellidos y nombres. */
  text: "*****",
  entidadFederal: "**",
  dia: "**",
  mes: "**",
  anio: "****",
  /** Sexo y, en primaria, resultados A–E y P. */
  short: "*",
} as const;

/** El valor recortado o, si está vacío, el relleno dado. */
export function orPlanillaEmpty(value: string | null | undefined, empty: string): string {
  return String(value ?? "").trim() || empty;
}

/** Relleno de casilla vacía ("*", "***", "*****"…): se imprime centrado. */
export function isPlanillaPlaceholder(text: string | null | undefined): boolean {
  return /^\*+$/.test(String(text ?? "").trim());
}

/** Formatea cada parte del nombre por separado y une con espacio. */
export function formatPlanillaStudentNameParts(
  parts: unknown[],
  useSpanishNames: boolean,
): string {
  return parts
    .filter((p) => p != null && String(p).trim() !== "")
    .map((p) => formatPlanillaStudentText(String(p), useSpanishNames))
    .join(" ");
}
