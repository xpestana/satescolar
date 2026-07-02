export function resolvePlanEstudio(
  tipoPlanilla: "31059" | "31060",
  mencionTexto?: string | null,
): string {
  return tipoPlanilla === "31060"
    ? (mencionTexto?.trim() || "EDUCACIÓN MEDIA GENERAL")
    : "EDUCACIÓN MEDIA GENERAL";
}
