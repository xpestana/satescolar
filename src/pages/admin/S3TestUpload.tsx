import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { uploadToS3, type S3Folder, type UploadResult } from "@/lib/s3-upload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface School {
  id: string;
  name: string;
}

const FOLDERS: S3Folder[] = ["assets", "logo", "students", "representatives", "teachers"];

export default function S3TestUpload() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [folder, setFolder] = useState<S3Folder>("assets");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");
      if (error) {
        toast.error("Error cargando colegios");
        return;
      }
      setSchools(data || []);
      if (data && data.length > 0) setSchoolId(data[0].id);
    })();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecciona un archivo");
      return;
    }
    if (!schoolId) {
      toast.error("Selecciona un colegio");
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const res = await uploadToS3({
        file,
        folder,
        schoolId,
        entityId: ["students", "representatives", "teachers"].includes(folder)
          ? "test-entity"
          : undefined,
      });
      setResult(res);
      toast.success("Archivo subido a S3 correctamente");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Error subiendo a S3");
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async () => {
    if (!result?.publicUrl) return;
    await navigator.clipboard.writeText(result.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isImage = file?.type.startsWith("image/");

  return (
    <DashboardLayout>
      <PageHeader
        title="Prueba de subida a S3"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Prueba S3" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subir archivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Colegio (define la carpeta raíz)</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un colegio" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Carpeta destino</Label>
              <Select value={folder} onValueChange={(v) => setFolder(v as S3Folder)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLDERS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ruta final:{" "}
                <code className="text-[11px]">
                  schools/&lt;schoolId&gt;/{folder}/
                  {["students", "representatives", "teachers"].includes(folder)
                    ? "test-entity/"
                    : ""}
                  &lt;timestamp&gt;-&lt;file&gt;
                </code>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Archivo (imagen, PDF, lo que sea)</Label>
              <Input
                type="file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setResult(null);
                }}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB · {file.type || "—"}
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !schoolId}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo a S3...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir a S3
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-muted-foreground">
                Sube un archivo para ver aquí su URL pública en S3.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Subida correcta
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Key</Label>
                  <code className="block text-[11px] bg-muted p-2 rounded break-all">
                    {result.key}
                  </code>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">URL pública</Label>
                  <div className="flex gap-2">
                    <Input value={result.publicUrl} readOnly className="text-xs" />
                    <Button size="icon" variant="outline" onClick={copyUrl}>
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="icon" variant="outline" asChild>
                      <a href={result.publicUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Tamaño: {(result.fileSize / 1024).toFixed(1)} KB</div>
                  <div>Tipo: {result.mimeType}</div>
                </div>

                {isImage && (
                  <div className="space-y-1">
                    <Label className="text-xs">Vista previa</Label>
                    <img
                      src={result.publicUrl}
                      alt="Subida S3"
                      className="max-h-64 rounded border"
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
