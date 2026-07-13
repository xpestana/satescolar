import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";
import logoMppeNuevo from "@/assets/logo-mppe-nuevo.jpg";
import { generateResumenFinalDocxBase } from "./resumen-final-docx-base";

export function generateResumenFinal31060Docx(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[],
) {
  return generateResumenFinalDocxBase(sections, {
    includeGpGrupo: false,
    logoUrl: logoMppeNuevo,
    logoMarginLeft: -40,
    useSpanishNames: true,
    pageLayoutExtra: {
      headerBlockExtra: 500,
      pageBufferExtra: 450,
      profesoresWrapEstimate: true,
    },
  });
}
