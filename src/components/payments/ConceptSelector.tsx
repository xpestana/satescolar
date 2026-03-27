import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ConceptBalance {
  id: string;
  plan_concept_id: string;
  concept_name: string;
  concept_type: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
}

interface ConceptSelectorProps {
  balances: ConceptBalance[];
  selectedIds: string[];
  partialAmounts: Record<string, number>;
  onToggle: (id: string) => void;
  onPartialAmountChange: (id: string, amount: number) => void;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  partial: { label: "Parcial", variant: "secondary" },
  paid: { label: "Pagado", variant: "default" },
  overdue: { label: "Vencido", variant: "destructive" },
};

export function ConceptSelector({ balances, selectedIds, partialAmounts, onToggle, onPartialAmountChange }: ConceptSelectorProps) {
  const total = balances
    .filter(b => selectedIds.includes(b.plan_concept_id))
    .reduce((sum, b) => {
      const amt = partialAmounts[b.plan_concept_id] !== undefined ? partialAmounts[b.plan_concept_id] : b.balance;
      return sum + amt;
    }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">Conceptos a cancelar</span>
        <span className="text-sm font-bold text-primary">Total: Bs. {total.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="border rounded-lg divide-y">
        {balances.map(b => {
          const selected = selectedIds.includes(b.plan_concept_id);
          const isPaid = b.status === "paid";
          const s = statusLabels[b.status] || statusLabels.pending;

          return (
            <div key={b.plan_concept_id} className={`flex items-center gap-3 p-3 ${isPaid ? "opacity-50" : ""}`}>
              <Checkbox
                checked={selected}
                disabled={isPaid}
                onCheckedChange={() => onToggle(b.plan_concept_id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{b.concept_name}</span>
                  <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Total: Bs. {b.total_amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })} | Pagado: Bs. {b.paid_amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })} | Saldo: Bs. {b.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
              </div>
              {selected && !isPaid && (
                <Input
                  type="number"
                  step="0.01"
                  className="w-32 h-8 text-sm"
                  value={partialAmounts[b.plan_concept_id] !== undefined ? partialAmounts[b.plan_concept_id] : b.balance}
                  onChange={e => onPartialAmountChange(b.plan_concept_id, parseFloat(e.target.value) || 0)}
                  max={b.balance}
                />
              )}
            </div>
          );
        })}
        {balances.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">No hay conceptos asignados</div>
        )}
      </div>
    </div>
  );
}
