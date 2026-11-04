import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { formatDateOnly, todayCaracasIso } from "@/lib/dateUtils";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";
import { PERSON_TYPE_LABELS, type AmountMode, type IslrConcept, type PersonType } from "@/lib/payroll/withholdings/types";

interface IslrRateFormDialogProps {
  schoolId: string;
  concept: IslrConcept | null;
  personType: PersonType;
  onClose: () => void;
}

const MODE_LABELS: Record<AmountMode, string> = {
  none: "No aplica",
  auto: "Automático (según la UT)",
  manual: "Monto fijo",
};

/** Adds a new version of an ISLR percentage, showing the current value next to the new one. */
export function IslrRateFormDialog({ schoolId, concept, personType: initialPersonType, onClose }: IslrRateFormDialogProps) {
  const { toast } = useToast();
  const { rates, addRate } = usePayrollTaxConfig(schoolId);
  const today = todayCaracasIso();

  const [personType, setPersonType] = useState<PersonType>(initialPersonType);
  const [validFrom, setValidFrom] = useState(today);
  const [basePct, setBasePct] = useState("100");
  const [ratePct, setRatePct] = useState("");
  const [subtrahendMode, setSubtrahendMode] = useState<AmountMode>("none");
  const [subtrahendAmount, setSubtrahendAmount] = useState("0");
  const [minimumMode, setMinimumMode] = useState<AmountMode>("none");
  const [minimumAmount, setMinimumAmount] = useState("0");

  const current = concept
    ? resolveRateVersion(rates.filter((r) => r.concept_id === concept.id && r.person_type === personType), today)
    : null;

  useEffect(() => {
    setValidFrom(today);
    setBasePct(String(current?.base_pct ?? 100));
    setRatePct(current ? String(current.rate_pct) : "");
    setSubtrahendMode(current?.subtrahend_mode ?? "none");
    setSubtrahendAmount(String(current?.subtrahend_amount ?? 0));
    setMinimumMode(current?.minimum_mode ?? "none");
    setMinimumAmount(String(current?.minimum_amount ?? 0));
  }, [current, today, concept?.id]);

  useEffect(() => setPersonType(initialPersonType), [initialPersonType, concept?.id]);

  const inRange = (value: string) => value !== "" && Number(value) >= 0 && Number(value) <= 100;
  const canSave = inRange(basePct) && inRange(ratePct) && validFrom >= today;

  const save = () => {
    if (!concept) return;
    addRate.mutate(
      {
        concept_id: concept.id,
        person_type: personType,
        valid_from: validFrom,
        base_pct: Number(basePct),
        rate_pct: Number(ratePct),
        subtrahend_mode: subtrahendMode,
        subtrahend_amount: Number(subtrahendAmount) || 0,
        minimum_mode: minimumMode,
        minimum_amount: Number(minimumAmount) || 0,
      },
      {
        onSuccess: () => {
          toast({ title: "Porcentaje guardado", description: `Aplica desde el ${formatDateOnly(validFrom)}.` });
          onClose();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={!!concept} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{concept?.name}</DialogTitle>
          <DialogDescription>
            {current
              ? `Vigente: ${current.rate_pct} % desde ${formatDateOnly(current.valid_from)}. Los pagos anteriores no cambian.`
              : "Sin porcentaje vigente para este tipo de persona."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tipo de persona</Label>
            <Select value={personType} onValueChange={(v) => setPersonType(v as PersonType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERSON_TYPE_LABELS) as PersonType[]).map((p) => (
                  <SelectItem key={p} value={p}>{PERSON_TYPE_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="islr-rate">% de retención *</Label>
              <Input id="islr-rate" type="number" step="0.01" min="0" max="100" value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
              {current && ratePct !== "" && Number(ratePct) !== Number(current.rate_pct) && (
                <p className="text-xs text-amber-600">{current.rate_pct} % → {ratePct} %</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="islr-base">% de la base</Label>
              <Input id="islr-base" type="number" step="0.01" min="0" max="100" value={basePct} onChange={(e) => setBasePct(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto mínimo</Label>
              <Select value={minimumMode} onValueChange={(v) => setMinimumMode(v as AmountMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as AmountMode[]).map((m) => <SelectItem key={m} value={m}>{MODE_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
              {minimumMode === "manual" && (
                <Input aria-label="Monto mínimo en bolívares" type="number" step="0.01" min="0" value={minimumAmount} onChange={(e) => setMinimumAmount(e.target.value)} />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sustraendo</Label>
              <Select value={subtrahendMode} onValueChange={(v) => setSubtrahendMode(v as AmountMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as AmountMode[]).map((m) => <SelectItem key={m} value={m}>{MODE_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
              {subtrahendMode === "manual" && (
                <Input aria-label="Sustraendo en bolívares" type="number" step="0.01" min="0" value={subtrahendAmount} onChange={(e) => setSubtrahendAmount(e.target.value)} />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="islr-valid-from">Aplica desde *</Label>
            <Input id="islr-valid-from" type="date" min={today} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!canSave || addRate.isPending}>
            {addRate.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Guardar versión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
