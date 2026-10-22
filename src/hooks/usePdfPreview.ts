import { useCallback, useEffect, useRef, useState } from "react";
import { htmlToPdfBlob } from "@/lib/htmlToPdfDownload";

export interface PdfPreview {
  blobUrl: string;
  filename: string;
  title: string;
}

/**
 * Turns a generated HTML document (boleta, diagnóstico…) into a PDF blob for `PdfPreviewDialog`,
 * and releases the blob URL when the preview closes or the component unmounts.
 */
export function usePdfPreview() {
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const urlRef = useRef<string | null>(null);

  const revoke = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  const openPreview = useCallback(async (html: string, filename: string, title: string) => {
    const blob = await htmlToPdfBlob(html);
    revoke();
    const blobUrl = URL.createObjectURL(blob);
    urlRef.current = blobUrl;
    setPreview({ blobUrl, filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`, title });
  }, []);

  const closePreview = useCallback(() => {
    revoke();
    setPreview(null);
  }, []);

  useEffect(() => revoke, []);

  return { preview, openPreview, closePreview };
}
