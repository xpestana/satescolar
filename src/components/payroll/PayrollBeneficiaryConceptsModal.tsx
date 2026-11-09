import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollConcepts } from "@/hooks/payroll/usePayrollConcepts";
import { usePayrollBeneficiaryConcepts } from "@/hooks/payroll/usePayrollBeneficiaryConcepts";
import { isDefaultFor, type BeneficiaryConcept } from "@/lib/payroll/defaultConcepts";
import { CATEGORY_LABELS, type PayrollBeneficiary } from "@/lib/payroll/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  beneficiary: PayrollBeneficiary;
}

type Row = { included: boolean; amount: string };

/** What comes filled in when paying this worker: which concepts and with what amount. */
export function PayrollBeneficiaryConceptsModal({ open, onOpenChange, schoolId, beneficiary }: Props) {
  const { toast } = useToast();
  const { concepts } = usePayrollConcepts(schoolId);
  const { own, isFetched, save } = usePayrollBeneficiaryConcepts(schoolId, beneficiary.id);
  const active = concepts.filter((c) => c.is_active);
  const [rows, setRows] = useState<Record<string, Row>>({});

  useEffect(() => {
    if (!open || !isFetched) return;
    const next: Record<string, Row> = {};
    for (const c of concepts) {
      const mine = own.find((o) => o.concept_id === c.id);
      next[c.id] = {
        included: mine ? mine.enabled : isDefaultFor(c, beneficiary.category),
        amount: mine?.amount != null ? String(mine.amount) : "",
      };
    }
    setRows(next);
  }, [open, isFetched, own, concepts, beneficiary.category]);

  const update = (id: string, patch: Partial<Row>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const invalid = active.some((c) => {
    const value = rows[c.id]?.amount.trim();
    return !!value && (!Number.isFinite(Number(value)) || Number(value) < 0);
  });

  const handleSave = () => {
    // Only what differs from the concept's default is stored.
    const changes: BeneficiaryConcept[] = [];
    for (const c of active) {
      const row = rows[c.id];
      if (!row) continue;
      const amount = row.included && row.amount.trim() !== "" ? Number(row.amount) : null;
      if (row.included !== isDefaultFor(c, beneficiary.category) || amount !== null) {
        changes.push({ concept_id: c.id, enabled: row.included, amount });
      }
    }
    save.mutate(changes, {
      onSuccess: () => {
        toast({ title: "Conceptos guardados", description: "Saldrán así al registrar sus pagos." });
        onOpenChange(false);
      },
      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">Conceptos de {beneficiary.full_name}</DialogTitle>
          <DialogDescription>
            Marque lo que se le paga o descuenta normalmente. Al registrar su pago saldrá ya puesto y solo tendrá que
            revisarlo. Deje el monto vacío para usar el del concepto.
          </DialogDescription>
        </DialogHeader>

        {!isFetched ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay conceptos. Créelos en Configuración → Conceptos.</p>
        ) : (
          <div className="space-y-2">
            {active.map((c) => {
              const row = rows[c.id] ?? { included: false, amount: "" };
              const byDefault = isDefaultFor(c, beneficiary.category);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-md border p-2">
                  <Checkbox
                    id={`concept-${c.id}`}
                    checked={row.included}
                    onCheckedChange={(checked) => update(c.id, { included: checked === true })}
                    aria-label={`Incluir ${c.name}`}
                  />
                  <label htmlFor={`concept-${c.id}`} className="flex-1 min-w-[140px] text-sm">
                    <span className="font-medium">{c.name}</span>{" "}
                    <Badge variant={c.concept_kind === "deduction" ? "destructive" : "outline"} className="ml-1">
                      {c.concept_kind === "deduction" ? "Deducción" : "Asignación"}
                    </Badge>
                    {byDefault && (
                      <span className="block text-xs text-muted-foreground">
                        Por defecto para {CATEGORY_LABELS[beneficiary.category].toLowerCase()}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-8 w-28 text-xs"
                      disabled={!row.included}
                      value={row.amount}
                      placeholder={String(c.default_amount)}
                      onChange={(e) => update(c.id, { amount: e.target.value })}
                      aria-label={`Monto de ${c.name}`}
                    />
                    <span className="text-xs text-muted-foreground w-8">{c.currency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isFetched || invalid || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
