import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollPeriods } from "@/hooks/payroll/usePayrollPeriods";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { periodsGuide } from "@/components/payroll/payrollGuides";
import type { PayrollPeriodType } from "@/lib/payroll/types";

export function PayrollPeriodsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { periods, isLoading, savePeriod, setApplyDeductions, deletePeriod } = usePayrollPeriods(schoolId);

  const [name, setName] = useState("");
  const [type, setType] = useState<PayrollPeriodType>("monthly");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applyDeductions, setApplyDeductionsInput] = useState(true);

  const handleAdd = () => {
    if (!name.trim() || !start || !end) {
      toast({ title: "Complete nombre y fechas", variant: "destructive" });
      return;
    }
    if (end < start) {
      toast({ title: "La fecha final no puede ser anterior a la inicial", variant: "destructive" });
      return;
    }
    savePeriod.mutate(
      { name: name.trim(), period_type: type, start_date: start, end_date: end, apply_deductions: applyDeductions },
      {
        onSuccess: () => {
          toast({ title: "Período guardado" });
          setName("");
          setStart("");
          setEnd("");
          setApplyDeductionsInput(true);
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-4">
      <PayrollGuide guide={periodsGuide()} className="mb-0" />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Julio 2026, 1ra quincena julio..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as PayrollPeriodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="biweekly">Quincenal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button className="self-end" onClick={handleAdd} disabled={savePeriod.isPending}>
              {savePeriod.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="md:col-span-5 flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Switch
              id="period-apply-deductions"
              checked={applyDeductions}
              onCheckedChange={setApplyDeductionsInput}
            />
            <div className="space-y-0.5">
              <Label htmlFor="period-apply-deductions" className="text-sm">Descontar retenciones y deducciones</Label>
              <p className="text-xs text-muted-foreground">
                {applyDeductions
                  ? "Los sueldos de este período descuentan el ISLR (AR-I) y los parafiscales, calculados sobre todo el mes."
                  : "Los sueldos de este período se pagan completos. Se descontarán en el período de este mes que sí descuenta."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rango</TableHead>
                <TableHead>Descuenta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : periods.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No hay períodos configurados.</TableCell></TableRow>
              ) : (
                periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.period_type === "biweekly" ? "Quincenal" : "Mensual"}</TableCell>
                    <TableCell className="text-sm">{fmt(p.start_date)} — {fmt(p.end_date)}</TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`${p.name} descuenta retenciones y deducciones`}
                        checked={p.apply_deductions}
                        disabled={setApplyDeductions.isPending}
                        onCheckedChange={(checked) =>
                          setApplyDeductions.mutate(
                            { id: p.id, applyDeductions: checked },
                            {
                              onSuccess: () => toast({ title: checked ? "El período descontará" : "El período se pagará completo" }),
                              onError: (e: Error) => toast({ title: "No se pudo cambiar", description: e.message, variant: "destructive" }),
                            }
                          )
                        }
                      />
                    </TableCell>
                    <TableCell><Badge variant={p.status === "open" ? "outline" : "secondary"}>{p.status === "open" ? "Abierto" : "Cerrado"}</Badge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => deletePeriod.mutate(p.id, { onSuccess: () => toast({ title: "Período eliminado" }), onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }) })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
