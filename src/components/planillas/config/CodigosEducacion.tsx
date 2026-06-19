import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type EducationCodes, type usePlanillasConfig } from "@/hooks/usePlanillasConfig";

type Props = ReturnType<typeof usePlanillasConfig>;

export function CodigosEducacion({ educationCodes, saveEducationCodes, isLoading }: Pick<Props, "educationCodes" | "saveEducationCodes" | "isLoading">) {
  const [form, setForm] = useState<EducationCodes>(educationCodes);

  useEffect(() => { setForm(educationCodes); }, [educationCodes]);

  const set = (key: keyof EducationCodes) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    saveEducationCodes.mutate(form, {
      onSuccess: () => toast.success("Códigos guardados"),
      onError: (e: any) => toast.error(e.message || "Error al guardar"),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de cabeceras</CardTitle>
        <CardDescription>Aqui se llenan los codigos utilizados en cada area</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="educacion_inicial">Educación Inicial</Label>
            <Input id="educacion_inicial" value={form.educacion_inicial} onChange={set("educacion_inicial")} placeholder="Ej. EI - 01 - 00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigos_educacion_inicial">Códigos Educación Inicial</Label>
            <Input id="codigos_educacion_inicial" value={form.codigos_educacion_inicial} onChange={set("codigos_educacion_inicial")} placeholder="Ej. 00001" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="educacion_primaria">Educación Primaria</Label>
            <Input id="educacion_primaria" value={form.educacion_primaria} onChange={set("educacion_primaria")} placeholder="Ej. DEA - 00 - 00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigos_educacion_primaria">Códigos Educación Primaria</Label>
            <Input id="codigos_educacion_primaria" value={form.codigos_educacion_primaria} onChange={set("codigos_educacion_primaria")} placeholder="Ej. 00002" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="educacion_media_general">Educación Media General</Label>
            <Input id="educacion_media_general" value={form.educacion_media_general} onChange={set("educacion_media_general")} placeholder="Ej. EMG CT 00000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="educacion_media_tecnica">Educación Media Técnica</Label>
            <Input id="educacion_media_tecnica" value={form.educacion_media_tecnica} onChange={set("educacion_media_tecnica")} placeholder="Ej. EMT 00000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="codigo_titulo">Código Titulo</Label>
            <Input id="codigo_titulo" value={form.codigo_titulo} onChange={set("codigo_titulo")} placeholder="Ej. 00000" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mencion_media_general" className="text-destructive font-medium">
            Educación Media General Mencion En:
          </Label>
          <Textarea
            id="mencion_media_general"
            value={form.mencion_media_general}
            onChange={set("mencion_media_general")}
            placeholder="Ej. CIENCIAS NATURALES"
            className="resize-none"
            rows={2}
          />
        </div>

        <div className="flex justify-start pt-2">
          <Button onClick={handleSave} disabled={saveEducationCodes.isPending}>
            {saveEducationCodes.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
