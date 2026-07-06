import { generateResumenFinal31059Docx } from "./resumen-final-31059-docx";
import { generateResumenFinal31060Docx } from "./resumen-final-31060-docx";
import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";

export { downloadBlob } from "./resumen-final-docx-base";

export type DocxResult = {
  blob: Blob;
  tipoPlanilla: "31059" | "31060";
};

export async function generateResumenFinalDocx(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[],
): Promise<DocxResult[]> {
  const arr = Array.isArray(sections) ? sections : [sections];

  const groups59 = arr.filter((s) => String(s.tipoPlanilla).trim() !== "31060");
  const groups60 = arr.filter((s) => String(s.tipoPlanilla).trim() === "31060");

  const results: DocxResult[] = [];

  if (groups59.length > 0) {
    const blob = await generateResumenFinal31059Docx(groups59);
    results.push({ blob, tipoPlanilla: "31059" });
  }
  if (groups60.length > 0) {
    const blob = await generateResumenFinal31060Docx(groups60);
    results.push({ blob, tipoPlanilla: "31060" });
  }

  return results;
}
