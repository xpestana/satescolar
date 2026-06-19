import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type SchoolHeader, type usePlanillasConfig } from "@/hooks/usePlanillasConfig";

type Props = ReturnType<typeof usePlanillasConfig>;

export function DatosComunes({ schoolHeader, saveSchoolHeader, isLoading }: Pick<Props, "schoolHeader" | "saveSchoolHeader" | "isLoading">) {
  const [form, setForm] = useState<SchoolHeader>(schoolHeader);

  useEffect(() => { setForm(schoolHeader); }, [schoolHeader]);

  const set = (key: keyof SchoolHeader) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    saveSchoolHeader.mutate(form, {
      onSuccess: () => toast.success("Datos comunes guardados"),
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
        <CardDescription>Aqui se llenan los datos que necesitan las cabeceras de las planillas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="codigo_plantel">Codigo del plantel <span className="text-destructive">*</span></Label>
            <Input id="codigo_plantel" value={form.codigo_plantel} onChange={set("codigo_plantel")} placeholder="PD17261412" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nombre_plantel">Nombre del plantel <span className="text-destructive">*</span></Label>
            <Input id="nombre_plantel" value={form.nombre_plantel} onChange={set("nombre_plantel")} placeholder="UNIDAD EDUCATIVA COLEGIO SANTO DOMINGO DE GUZMÁN" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono_plantel">Telefono del plantel <span className="text-destructive">*</span></Label>
            <Input id="telefono_plantel" value={form.telefono_plantel} onChange={set("telefono_plantel")} placeholder="0274 - 2667989" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entidad_federal">Entidad federal <span className="text-destructive">*</span></Label>
            <Input id="entidad_federal" value={form.entidad_federal} onChange={set("entidad_federal")} placeholder="MÉRIDA" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zona_educativa">Zona Educativa <span className="text-destructive">*</span></Label>
            <Input id="zona_educativa" value={form.zona_educativa} onChange={set("zona_educativa")} placeholder="Nº 14 Mérida" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="director">Director(a) <span className="text-destructive">*</span></Label>
            <Input id="director" value={form.director} onChange={set("director")} placeholder="PEREZ PRIETO MARIA TERESA" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cedula_director">Cédula de identidad <span className="text-destructive">*</span></Label>
            <Input id="cedula_director" value={form.cedula_director} onChange={set("cedula_director")} placeholder="V 7.276.231" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="direccion_plantel">Dirección del plantel <span className="text-destructive">*</span></Label>
            <Input id="direccion_plantel" value={form.direccion_plantel} onChange={set("direccion_plantel")} placeholder="AV. LAS AMERICAS SECTOR SANTA BARBARA ESTE" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="municipio_plantel">Municipio del plantel <span className="text-destructive">*</span></Label>
            <Input id="municipio_plantel" value={form.municipio_plantel} onChange={set("municipio_plantel")} placeholder="LIBERTADOR" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_remision">Fecha de Remisión</Label>
            <Input id="fecha_remision" type="date" value={form.fecha_remision} onChange={set("fecha_remision")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coordinador_control_estudio">Coordinador de Control de Estudio <span className="text-destructive">*</span></Label>
            <Input id="coordinador_control_estudio" value={form.coordinador_control_estudio} onChange={set("coordinador_control_estudio")} placeholder="VELEZ DIAZ PAOLA" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cedula_coordinador">Cédula de identidad del Coordinador <span className="text-destructive">*</span></Label>
            <Input id="cedula_coordinador" value={form.cedula_coordinador} onChange={set("cedula_coordinador")} placeholder="V 23.212.281" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="funcionario_ministerio">Funcionario Designado por el Ministerio de Educación <span className="text-destructive">*</span></Label>
            <Input id="funcionario_ministerio" value={form.funcionario_ministerio} onChange={set("funcionario_ministerio")} placeholder="DÍAZ LOBO BEATRIZ" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cedula_funcionario">Cédula de identidad del Funcionario <span className="text-destructive">*</span></Label>
            <Input id="cedula_funcionario" value={form.cedula_funcionario} onChange={set("cedula_funcionario")} placeholder="V 9.472.930" />
          </div>
        </div>

        <div className="flex justify-start pt-2">
          <Button onClick={handleSave} disabled={saveSchoolHeader.isPending}>
            {saveSchoolHeader.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
