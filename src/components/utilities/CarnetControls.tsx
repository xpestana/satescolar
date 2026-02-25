import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GripHorizontal, Move, Type, Image, QrCode } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { CarnetLayoutConfig } from "./CarnetEditor";

interface CarnetControlsProps {
  layout: CarnetLayoutConfig;
  onLayoutChange: (layout: CarnetLayoutConfig) => void;
}

export function CarnetControls({ layout, onLayoutChange }: CarnetControlsProps) {
  const updateFontSize = (key: keyof CarnetLayoutConfig["fontSizes"], val: number) => {
    onLayoutChange({ ...layout, fontSizes: { ...layout.fontSizes, [key]: val } });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GripHorizontal className="h-4 w-4" /> Encabezado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">Altura: {layout.headerHeight}px</Label>
          <Slider
            value={[layout.headerHeight]}
            onValueChange={(v) => onLayoutChange({ ...layout, headerHeight: v[0] })}
            min={50}
            max={160}
            step={1}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Image className="h-4 w-4" /> Logo del Encabezado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">Tamaño: {layout.logoSize}px</Label>
          <Slider
            value={[layout.logoSize]}
            onValueChange={(v) => onLayoutChange({ ...layout, logoSize: v[0] })}
            min={16}
            max={60}
            step={1}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Move className="h-4 w-4" /> Foto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">Tamaño: {layout.photoSize}px</Label>
          <Slider
            value={[layout.photoSize]}
            onValueChange={(v) => onLayoutChange({ ...layout, photoSize: v[0] })}
            min={30}
            max={90}
            step={1}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Código QR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">Tamaño: {layout.qrSize}px</Label>
          <Slider
            value={[layout.qrSize]}
            onValueChange={(v) => onLayoutChange({ ...layout, qrSize: v[0] })}
            min={20}
            max={70}
            step={1}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Type className="h-4 w-4" /> Tamaños de Fuente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Nombre del colegio: {layout.fontSizes.schoolName}px</Label>
            <Slider value={[layout.fontSizes.schoolName]} onValueChange={(v) => updateFontSize("schoolName", v[0])} min={5} max={14} step={0.5} className="mt-2" />
          </div>
          <Separator />
          <div>
            <Label className="text-xs">Nombre del estudiante: {layout.fontSizes.studentName}px</Label>
            <Slider value={[layout.fontSizes.studentName]} onValueChange={(v) => updateFontSize("studentName", v[0])} min={6} max={16} step={0.5} className="mt-2" />
          </div>
          <Separator />
          <div>
            <Label className="text-xs">Cédula/documento: {layout.fontSizes.document}px</Label>
            <Slider value={[layout.fontSizes.document]} onValueChange={(v) => updateFontSize("document", v[0])} min={5} max={14} step={0.5} className="mt-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
