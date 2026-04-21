import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, Film, FileArchive } from "lucide-react";
import { uploadToS3, type S3Folder } from "@/lib/s3-upload";
import { toast } from "@/hooks/use-toast";

export interface PendingAttachment {
  id: string; // local id
  file: File;
  publicUrl?: string;
  uploading: boolean;
  error?: string;
}

interface Props {
  folder: S3Folder;
  schoolId: string;
  classroomId: string;
  entityId?: string; // optional sub-folder (post id, activity id, submission id)
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  disabled?: boolean;
  buttonLabel?: string;
  maxFileSizeMb?: number;
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.includes("zip") || mime.includes("rar")) return FileArchive;
  return FileText;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Botón "Adjuntar archivo" + lista de chips de archivos pendientes.
 * Sube cada archivo a AWS S3 inmediatamente y guarda la URL pública en el estado.
 * El componente padre persiste las URLs en BD al guardar el post / actividad / entrega.
 */
export function S3AttachmentInput({
  folder,
  schoolId,
  classroomId,
  entityId,
  attachments,
  onChange,
  disabled,
  buttonLabel = "Adjuntar archivo",
  maxFileSizeMb = 25,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);

    for (const file of list) {
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        toast({
          title: "Archivo demasiado grande",
          description: `${file.name} excede ${maxFileSizeMb} MB`,
          variant: "destructive",
        });
        continue;
      }

      const localId = crypto.randomUUID();
      const pending: PendingAttachment = {
        id: localId,
        file,
        uploading: true,
      };
      onChange([...attachments, pending]);
      setBusy(true);

      try {
        const result = await uploadToS3({
          file,
          folder,
          schoolId,
          classroomId,
          entityId,
        });
        // Use a fresh snapshot to avoid stale state
        onChange((prev => prev.map(a => a.id === localId
          ? { ...a, uploading: false, publicUrl: result.publicUrl }
          : a))(attachments.concat(pending)));
      } catch (err: any) {
        toast({
          title: "Error subiendo archivo",
          description: err?.message || "Inténtalo de nuevo",
          variant: "destructive",
        });
        onChange(attachments.filter(a => a.id !== localId).concat([]));
      } finally {
        setBusy(false);
      }
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (id: string) => {
    onChange(attachments.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4 mr-1" />
        )}
        {buttonLabel}
      </Button>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map(a => {
            const Icon = iconFor(a.file.type);
            return (
              <Badge
                key={a.id}
                variant="secondary"
                className="gap-1.5 pl-2 pr-1 py-1 max-w-xs"
              >
                {a.uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                ) : (
                  <Icon className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate text-xs">{a.file.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {fmtBytes(a.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="ml-0.5 p-0.5 rounded hover:bg-muted-foreground/10"
                  aria-label="Quitar"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
