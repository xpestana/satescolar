import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import type { PdfPreview } from "@/hooks/usePdfPreview";

function downloadBlobUrl(blobUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Full-screen preview of a generated PDF with its download button. */
export default function PdfPreviewDialog({ preview, onClose }: {
  preview: PdfPreview | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!preview} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3 border-b shrink-0 space-y-0">
          <DialogTitle className="text-sm font-semibold truncate">
            {preview?.title ?? "Documento"}
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="gap-1.5" onClick={() => preview && downloadBlobUrl(preview.blobUrl, preview.filename)}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Descargar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-neutral-100 relative">
          {preview && (
            <>
              {/* Many phone browsers can't render a PDF inside an iframe: point them to the download. */}
              <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-muted-foreground md:hidden">
                Si no ves el documento, usa el botón PDF para descargarlo.
              </p>
              <iframe src={preview.blobUrl} className="relative w-full h-full border-0 bg-transparent" title={preview.title} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
