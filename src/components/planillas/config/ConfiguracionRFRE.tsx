import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type RfreConfig, type usePlanillasConfig } from "@/hooks/usePlanillasConfig";

type Props = ReturnType<typeof usePlanillasConfig>;

export function ConfiguracionRFRE({ rfreConfig, saveRfreConfig, isLoading }: Pick<Props, "rfreConfig" | "saveRfreConfig" | "isLoading">) {
  const [form, setForm] = useState<RfreConfig>(rfreConfig);

  useEffect(() => { setForm(rfreConfig); }, [rfreConfig]);

  const handleSave = () => {
    saveRfreConfig.mutate(form, {
      onSuccess: () => toast.success("Configuración RFRE guardada"),
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
        <CardTitle>Datos del RFRE</CardTitle>
        <CardDescription>Aqui se realiza la configuración del RFRE</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <Label htmlFor="acronimo_gcrp">
            Acrónimo del Grupo de Creación, Recreación y Participación
          </Label>
          <Input
            id="acronimo_gcrp"
            value={form.acronimo_gcrp}
            onChange={(e) => setForm({ acronimo_gcrp: e.target.value })}
            placeholder="GCRP"
          />
        </div>

        <div className="flex justify-start pt-2">
          <Button onClick={handleSave} disabled={saveRfreConfig.isPending}>
            {saveRfreConfig.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
