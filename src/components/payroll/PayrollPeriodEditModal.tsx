import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PeriodInput } from "@/hooks/payroll/usePayrollPeriods";
import type { PayrollPeriod, PayrollPeriodType } from "@/lib/payroll/types";

interface Props {
  period: PayrollPeriod | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: PeriodInput & { id: string }) => Promise<unknown>;
}

/** Edits a period. The database refuses changing its month or whether it deducts once it has payments. */
export function PayrollPeriodEditModal({ period, saving, onClose, onSave }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<PayrollPeriodType>("monthly");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applyDeductions, setApplyDeductions] = useState(true);

  useEffect(() => {
    if (!period) return;
    setName(period.name);
    setType(period.period_type);
    setStart(period.start_date);
    setEnd(period.end_date);
    setApplyDeductions(period.apply_deductions);
  }, [period]);

  const handleSave = async () => {
    if (!period) return;
    if (!name.trim() || !start || !end) {
      toast({ title: "Complete nombre y fechas", variant: "destructive" });
      return;
    }
    if (end < start) {
      toast({ title: "La fecha final no puede ser anterior a la inicial", variant: "destructive" });
      return;
    }
    try {
      await onSave({ id: period.id, name: name.trim(), period_type: type, start_date: start, end_date: end, apply_deductions: applyDeductions });
      toast({ title: "Período actualizado" });
      onClose();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!period} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar período</DialogTitle>
          <DialogDescription>
            Si el período ya tiene pagos, puede cambiar el nombre y los días, pero no el mes ni si descuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="edit-period-name" className="text-xs">Nombre</Label>
            <Input id="edit-period-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as PayrollPeriodType)}>
              <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="biweekly">Quincenal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-period-start" className="text-xs">Desde</Label>
            <Input id="edit-period-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-period-end" className="text-xs">Hasta</Label>
            <Input id="edit-period-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="col-span-2 flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Switch id="edit-period-apply-deductions" checked={applyDeductions} onCheckedChange={setApplyDeductions} />
            <div className="space-y-0.5">
              <Label htmlFor="edit-period-apply-deductions" className="text-sm">Descontar retenciones y deducciones</Label>
              <p className="text-xs text-muted-foreground">
                {applyDeductions
                  ? "Los sueldos de este período descuentan el ISLR (AR-I) y los parafiscales, calculados sobre todo el mes."
                  : "Los sueldos de este período se pagan completos. Se descontarán en el período de este mes que sí descuenta."}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
