import { useState } from "react";
import { Download, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  downloadBachilleratoBoleta,
  downloadBachilleratoBoletaDefinitiva,
} from "@/lib/bachilleratoBoleta";
import { downloadPrimaryDescriptiveBoleta } from "@/lib/primaryDescriptiveBoleta";
import { htmlToPdfBlob } from "@/lib/htmlToPdfDownload";
import { gradeLabel } from "@/lib/gradeLevels";
import { MOMENTO_DEFINITIVA } from "@/hooks/useStudentReportCard";
import type { GradeLevelKind } from "@/lib/gradeLevels";

/**
 * Boleta download for the representative.
 *
 * It calls the very same generators the school uses, so the PDF a family downloads is the one the
 * school designed in /formatos (`boleta_templates`) — no second layout to keep in sync.
 */

interface StudentBoletaDownloadProps {
  schoolId: string;
  studentId: string;
  studentName: string;
  documentId: string | null;
  sectionId: string;
  sectionName: string;
  gradeKey: string;
  levelKind: GradeLevelKind;
  yearId: string;
  yearRange: string;
  momento: number;
}

export default function StudentBoletaDownload({
  schoolId,
  studentId,
  studentName,
  documentId,
  sectionId,
  sectionName,
  gradeKey,
  levelKind,
  yearId,
  yearRange,
  momento,
}: StudentBoletaDownloadProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<{ blobUrl: string; filename: string } | null>(null);

  const isDefinitiva = momento === MOMENTO_DEFINITIVA;
  const momentoLabel = isDefinitiva ? "Definitiva Final" : `Momento ${momento}`;

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  };

  const buildHtml = async (): Promise<string> => {
    const common = {
      schoolId,
      studentId,
      studentName,
      documentId,
      sectionId,
      sectionName,
      gradeLabel: gradeLabel(gradeKey),
      gradeKey,
      yearId,
      yearRange,
    };
    if (levelKind === "primary") {
      // Primary has no stored "definitiva": the third momento closes the year.
      return downloadPrimaryDescriptiveBoleta({ ...common, momento: isDefinitiva ? 3 : momento });
    }
    if (isDefinitiva) return downloadBachilleratoBoletaDefinitiva(common);
    return downloadBachilleratoBoleta({ ...common, momento });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const html = await buildHtml();
      const blob = await htmlToPdfBlob(html);
      const safeName = `Boleta_${studentName.replace(/\s+/g, "_")}_${momentoLabel.replace(/\s+/g, "_")}.pdf`;
      setPreview({ blobUrl: URL.createObjectURL(blob), filename: safeName });
    } catch (error) {
      console.error("No se pudo generar la boleta", error);
      toast.error("No se pudo generar la boleta. Intente nuevamente o comuníquese con el colegio.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview.blobUrl;
    link.download = preview.filename;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Descargar boleta</CardTitle>
        <CardDescription>
          {momentoLabel} · año escolar {yearRange}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {levelKind === "preschool" ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              La boleta de Preescolar estará disponible próximamente. Mientras tanto puede leer aquí
              el informe de su representado.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              La boleta se genera con el formato oficial que definió el colegio. Se abrirá una
              vista previa antes de descargar el archivo PDF.
            </p>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando boleta...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generar boleta de {momentoLabel.toLowerCase()}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Boleta de {studentName} · {momentoLabel}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <>
              <iframe
                src={preview.blobUrl}
                title="Vista previa de la boleta"
                className="flex-1 w-full rounded-md border"
              />
              <div className="flex justify-end">
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
