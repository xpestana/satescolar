import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Upload } from "lucide-react";
import { BoletinSignature } from "@/lib/bachilleratoTemplate";
import { uploadToS3 } from "@/lib/s3-upload";

export const MAX_SIGNATURES = 3;

export const emptySignature = (): BoletinSignature => ({
  nombre: "", cedula: "", cargo: "", firma_url: "", sello_url: "", enabled: true,
});

export function ImageUploadCell({ label, url, loading, onFile, onClear }: {
  label: string; url: string; loading: boolean;
  onFile: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="border rounded flex items-center justify-center h-16 bg-background relative overflow-hidden cursor-pointer"
        onClick={() => ref.current?.click()}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : url ? (
          <>
            <img src={url} alt="" className="max-h-full max-w-full object-contain p-1" />
            <button onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow text-destructive hover:bg-destructive hover:text-white">
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <Upload className="h-4 w-4 mx-auto mb-0.5" />
            <span className="text-[10px]">Subir imagen</span>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

export function InputRow({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs w-24 shrink-0">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="h-6 text-xs flex-1" />
    </div>
  );
}

/** Uploads a signature/stamp image to S3 and returns its public URL. */
export async function uploadSignatureImage(file: File, schoolId: string, prefix: string) {
  const result = await uploadToS3({
    file, folder: "assets", schoolId,
    fileName: `${prefix}-${Date.now()}-${file.name}`,
  });
  return result.publicUrl;
}

/** The five fields of a single signature: firma + sello images, nombre, cédula, cargo. */
export function SignatureFieldsCard({ sig, onChange, schoolId, uploadPrefix = "boleta-sig", disabled }: {
  sig: BoletinSignature;
  onChange: (patch: Partial<BoletinSignature>) => void;
  schoolId: string;
  uploadPrefix?: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const handleImg = async (field: "firma_url" | "sello_url", file: File) => {
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      onChange({ [field]: await uploadSignatureImage(file, schoolId, uploadPrefix) });
    } catch (e: any) {
      toast({ title: "Error subiendo imagen", description: e.message, variant: "destructive" });
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  };

  return (
    <div className={disabled ? "space-y-2 opacity-50 pointer-events-none" : "space-y-2"}>
      <div className="grid grid-cols-2 gap-2">
        <ImageUploadCell label="Imagen de firma" url={sig.firma_url} loading={!!uploading.firma_url}
          onFile={(f) => handleImg("firma_url", f)} onClear={() => onChange({ firma_url: "" })} />
        <ImageUploadCell label="Sello (opcional)" url={sig.sello_url} loading={!!uploading.sello_url}
          onFile={(f) => handleImg("sello_url", f)} onClear={() => onChange({ sello_url: "" })} />
      </div>

      <div className="space-y-1.5">
        <InputRow label="Nombre" value={sig.nombre} placeholder="Prof. Juan Pérez"
          onChange={(v) => onChange({ nombre: v })} />
        <InputRow label="Cédula (opcional)" value={sig.cedula} placeholder="V-12.345.678"
          onChange={(v) => onChange({ cedula: v })} />
        <InputRow label="Cargo" value={sig.cargo} placeholder="Director(a)"
          onChange={(v) => onChange({ cargo: v })} />
      </div>
    </div>
  );
}

/**
 * Editor for the up-to-3 signatures stored in a boleta template.
 * `showEnabled` adds a per-signature on/off switch — only the primaria_descriptivo
 * style honours `enabled` when rendering.
 */
export function SignatureEditor({ sigs, onChange, schoolId, showEnabled }: {
  sigs: BoletinSignature[];
  onChange: (sigs: BoletinSignature[]) => void;
  schoolId: string;
  showEnabled?: boolean;
}) {
  const upd = (i: number, patch: Partial<BoletinSignature>) => {
    const next = [...sigs];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {sigs.map((sig, i) => {
        const off = showEnabled && sig.enabled === false;
        return (
          <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {showEnabled && (
                  <Switch checked={sig.enabled !== false} className="scale-75"
                    onCheckedChange={(v) => upd(i, { enabled: v })} />
                )}
                <span className="text-xs font-semibold">Firma {i + 1}</span>
                {off && <span className="text-[10px] text-muted-foreground">(no se imprime)</span>}
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                onClick={() => onChange(sigs.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>

            <SignatureFieldsCard sig={sig} schoolId={schoolId} disabled={off}
              onChange={(patch) => upd(i, patch)} />
          </div>
        );
      })}

      {sigs.length < MAX_SIGNATURES && (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs"
          onClick={() => onChange([...sigs, emptySignature()])}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Agregar firma {sigs.length > 0 ? `(${sigs.length}/${MAX_SIGNATURES})` : ""}
        </Button>
      )}
      {sigs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">Agrega hasta {MAX_SIGNATURES} firmantes</p>
      )}
    </div>
  );
}
