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
import { usePayrollConcepts } from "@/hooks/payroll/usePayrollConcepts";
import type { ConceptKind, PayrollCurrency } from "@/lib/payroll/types";

export function PayrollConceptsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { concepts, isLoading, saveConcept, deleteConcept } = usePayrollConcepts(schoolId);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<ConceptKind>("earning");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<PayrollCurrency>("VES");

  const handleAdd = () => {
    if (!name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    saveConcept.mutate(
      { name: name.trim(), concept_kind: kind, default_amount: Number(amount) || 0, currency },
      {
        onSuccess: () => {
          toast({ title: "Concepto guardado" });
          setName("");
          setAmount("");
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sueldo base, Bono, Retención..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ConceptKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="earning">Asignación</SelectItem>
                <SelectItem value="deduction">Deducción</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Monto por defecto</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select value={currency} onValueChange={(v) => setCurrency(v as PayrollCurrency)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VES">VES</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={saveConcept.isPending}>
              {saveConcept.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : concepts.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No hay conceptos configurados.</TableCell></TableRow>
              ) : (
                concepts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.concept_kind === "deduction" ? "destructive" : "outline"}>
                        {c.concept_kind === "deduction" ? "Deducción" : "Asignación"}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.default_amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {c.currency}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => deleteConcept.mutate(c.id, { onSuccess: () => toast({ title: "Concepto eliminado" }) })}>
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
