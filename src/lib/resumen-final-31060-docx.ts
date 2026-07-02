import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";
import { generateResumenFinalDocxBase } from "./resumen-final-docx-base";

export function generateResumenFinal31060Docx(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[],
) {
  return generateResumenFinalDocxBase(sections, { includeGpGrupo: false });
}
