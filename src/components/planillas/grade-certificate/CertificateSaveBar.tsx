import { CheckCircle2, CircleDot, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CertificateSaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  isDownloading: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDownload: () => void;
}

/** Sticky bar with the save state of the certificate being edited and its Word download. */
export function CertificateSaveBar({ isDirty, isSaving, isDownloading, onSave, onDiscard, onDownload }: CertificateSaveBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg transition-colors",
        isDirty && "border-amber-300 bg-amber-50",
      )}
    >
      <p className={cn("flex items-center gap-2 text-sm", isDirty ? "font-medium text-amber-900" : "text-muted-foreground")}>
        {isDirty
          ? <><CircleDot className="h-4 w-4" /> Cambios sin guardar</>
          : <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Todo guardado</>}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!isDirty || isSaving}>
          Descartar
        </Button>
        <Button size="sm" variant={isDirty ? "default" : "outline"} onClick={onSave} disabled={!isDirty || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Guardar
        </Button>
        {/* The Word prints what is saved, so it waits for pending changes to be saved. */}
        <Button
          size="sm"
          variant={isDirty ? "outline" : "default"}
          onClick={onDownload}
          disabled={isDirty || isDownloading}
          title={isDirty ? "Guarda los cambios para descargar la planilla" : undefined}
        >
          {isDownloading
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <FileDown className="h-4 w-4 mr-1.5" />}
          Descargar Word
        </Button>
      </div>
    </div>
  );
}
