import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ConceptInput } from "@/hooks/payroll/usePayrollConcepts";
import type { ConceptKind, PayrollConcept, PayrollCurrency } from "@/lib/payroll/types";

interface Props {
  concept: PayrollConcept | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ConceptInput & { id: string }) => Promise<unknown>;
}

/**
 * Edits a concept's name, type, amount and currency. Payments already registered keep the name and
 * amounts they were saved with; the change applies to the next ones.
 */
export function PayrollConceptEditModal({ concept, saving, onClose, onSave }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ConceptKind>("earning");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<PayrollCurrency>("VES");

  useEffect(() => {
    if (!concept) return;
    setName(concept.name);
    setKind(concept.concept_kind);
    setAmount(String(concept.default_amount));
    setCurrency(concept.currency);
  }, [concept]);

  const parsedAmount = amount.trim() === "" ? 0 : Number(amount);
  const invalidAmount = !Number.isFinite(parsedAmount) || parsedAmount < 0;

  const handleSave = async () => {
    if (!concept) return;
    if (!name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (invalidAmount) {
      toast({ title: "El monto no puede ser negativo", variant: "destructive" });
      return;
    }
    // The base-salary, AR-I and contribution marks only apply to earnings.
    const earningOnly =
      kind === "deduction" ? { is_base_salary: false, is_islr_taxable: false, is_contribution_base: false } : {};
    try {
      await onSave({ id: concept.id, name: name.trim(), concept_kind: kind, default_amount: parsedAmount, currency, ...earningOnly });
      toast({ title: "Concepto actualizado" });
      onClose();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!concept} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar concepto</DialogTitle>
          <DialogDescription>
            Los pagos ya registrados conservan su nombre y montos; el cambio aplica a los próximos pagos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="edit-concept-name" className="text-xs">Nombre</Label>
            <Input id="edit-concept-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ConceptKind)}>
              <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="earning">Asignación</SelectItem>
                <SelectItem value="deduction">Deducción</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-concept-amount" className="text-xs">Monto por defecto</Label>
            <Input id="edit-concept-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Moneda</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as PayrollCurrency)}>
              <SelectTrigger aria-label="Moneda"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VES">VES</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {concept && kind === "deduction" && concept.concept_kind === "earning" &&
            (concept.is_base_salary || concept.is_islr_taxable || concept.is_contribution_base) && (
              <p className="col-span-2 text-xs text-muted-foreground">
                Al pasar a deducción deja de ser sueldo base y de contar para el AR-I y los parafiscales.
              </p>
            )}
          {concept && currency !== concept.currency && (
            <p className="col-span-2 text-xs text-muted-foreground">
              Los montos propios que algún trabajador tenga en este concepto se leerán en {currency}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || invalidAmount}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
