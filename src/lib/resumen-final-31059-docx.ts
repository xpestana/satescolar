import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";
import {
  downloadBlob,
  generateResumenFinalDocxBase,
} from "./resumen-final-docx-base";

export { downloadBlob };

export function generateResumenFinal31059Docx(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[],
) {
  return generateResumenFinalDocxBase(sections, { includeGpGrupo: true });
}
