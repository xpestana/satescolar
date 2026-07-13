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
