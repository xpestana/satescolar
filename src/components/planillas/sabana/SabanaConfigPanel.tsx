import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SabanaDisplayConfig } from "@/hooks/useSabanaConfig";

interface Props {
  config: SabanaDisplayConfig;
  onUpdate: (partial: Partial<SabanaDisplayConfig>) => void;
  onReset: () => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono font-medium tabular-nums">{value}{unit}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

export function SabanaConfigPanel({ config, onUpdate, onReset }: Props) {
  return (
    <Card className="shrink-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Configuración del PDF
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={onReset}
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restablecer
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Header color */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Color de cabecera</Label>
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded border flex-shrink-0 cursor-pointer relative overflow-hidden"
              style={{ backgroundColor: config.headerColor }}
              title="Seleccionar color"
            >
              <input
                type="color"
                value={config.headerColor}
                onChange={e => onUpdate({ headerColor: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground uppercase">{config.headerColor}</span>
          </div>
        </div>

        {/* Margins */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-foreground">Márgenes</Label>
          <SliderRow
            label="Horizontal (izq / der)"
            value={config.marginX}
            min={3}
            max={25}
            step={1}
            unit="mm"
            onChange={v => onUpdate({ marginX: v })}
          />
          <SliderRow
            label="Vertical (superior)"
            value={config.marginY}
            min={5}
            max={30}
            step={1}
            unit="mm"
            onChange={v => onUpdate({ marginY: v })}
          />
        </div>

        {/* Font sizes */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-foreground">Tamaño de letra</Label>
          <SliderRow
            label="Filas de la tabla"
            value={config.tableFontSize}
            min={5}
            max={14}
            step={0.5}
            unit="pt"
            onChange={v => onUpdate({ tableFontSize: v })}
          />
          <SliderRow
            label="Cabecera de la tabla"
            value={config.headerFontSize}
            min={5}
            max={14}
            step={0.5}
            unit="pt"
            onChange={v => onUpdate({ headerFontSize: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
