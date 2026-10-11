/** Notas de la escala de 20 puntos escritas en letras, como las pide la Certificación de Notas. */
const GRADE_WORDS = [
  "CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO",
  "DIECINUEVE", "VEINTE",
] as const;

/** "14" → "CATORCE", "09" → "NUEVE". Vacío, no entero o fuera de 0–20 → "". */
export function gradeInWords(grade: string | number | null | undefined): string {
  const text = String(grade ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) return "";
  return GRADE_WORDS[Number(text)] ?? "";
}
