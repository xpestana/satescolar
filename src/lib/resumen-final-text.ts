/** Mayusculiza texto de planilla respetando Ñ (locale es-VE) cuando spanish=true. */
export function formatPlanillaStudentText(
  text: string,
  useSpanishNames: boolean,
): string {
  const s = String(text ?? "").trim().normalize("NFC");
  if (!s) return "";
  return useSpanishNames ? s.toLocaleUpperCase("es-VE") : s.toUpperCase();
}
