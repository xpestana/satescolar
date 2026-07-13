import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollPeriods } from "@/hooks/payroll/usePayrollPeriods";
import type { PayrollPeriodType } from "@/lib/payroll/types";

export function PayrollPeriodsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { periods, isLoading, savePeriod, deletePeriod } = usePayrollPeriods(schoolId);

  const [name, setName] = useState("");
  const [type, setType] = useState<PayrollPeriodType>("monthly");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

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
      { name: name.trim(), period_type: type, start_date: start, end_date: end },
      {
        onSuccess: () => {
          toast({ title: "Período guardado" });
          setName("");
          setStart("");
          setEnd("");
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-4">
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
                <TableHead>Estado</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : periods.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No hay períodos configurados.</TableCell></TableRow>
              ) : (
                periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.period_type === "biweekly" ? "Quincenal" : "Mensual"}</TableCell>
                    <TableCell className="text-sm">{fmt(p.start_date)} — {fmt(p.end_date)}</TableCell>
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
