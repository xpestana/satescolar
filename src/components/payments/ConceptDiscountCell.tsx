import { useEffect, useState } from "react";
import { Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  computeAdHocDiscount,
  validateAdHocDiscount,
  type AdHocDiscountDraft,
} from "@/lib/paymentItemDiscount";

const EMPTY_DRAFT: AdHocDiscountDraft = { type: "fixed", value: "", reason: "" };

const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ConceptDiscountCellProps {
  conceptName: string;
  /** Moneda del concepto ("VES", "USD", …). */
  currency: string;
  /** Pendiente de la cuota en su moneda original. */
  pendingOriginal: number;
  /** Tasa moneda del concepto → VES. */
  rate: number;
  /** Descuento ya aplicado a esta cuota, si lo hay. */
  value: AdHocDiscountDraft | null;
  disabled?: boolean;
  onApply: (draft: AdHocDiscountDraft) => void;
  onClear: () => void;
}

/**
 * Celda "Descuento" de la tabla de conceptos: aplica un descuento puntual a una cuota,
 * adicional al descuento del plan. El descuento cierra la cuota (ver `paymentItemDiscount`).
 */
export function ConceptDiscountCell({
  conceptName,
  currency,
  pendingOriginal,
  rate,
  value,
  disabled,
  onApply,
  onClear,
}: ConceptDiscountCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdHocDiscountDraft>(value || EMPTY_DRAFT);

  useEffect(() => {
    if (open) setDraft(value || EMPTY_DRAFT);
  }, [open, value]);

  const preview = computeAdHocDiscount({
    type: draft.type,
    value: parseFloat(draft.value) || 0,
    pendingOriginal,
    rate,
  });
  const error = validateAdHocDiscount(draft, pendingOriginal, conceptName);

  const applied = value ? computeAdHocDiscount({ type: value.type, value: parseFloat(value.value) || 0, pendingOriginal, rate }) : null;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {applied && applied.discountVes > 0 ? (
            <Badge
              variant="outline"
              className="cursor-pointer gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              title={`Descuento de esta cuota · ${value?.reason || ""}`}
            >
              <Tag className="h-3 w-3" />
              −{fmt(applied.discountVes)}
            </Badge>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={disabled}>
              <Tag className="h-3 w-3" />
              Descuento
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3" align="start">
          <div>
            <p className="text-sm font-medium">Descuento de esta cuota</p>
            <p className="text-xs text-muted-foreground">{conceptName} · adicional al descuento del plan</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={draft.type === "none" ? "fixed" : draft.type} onValueChange={(v) => setDraft((d) => ({ ...d, type: v as AdHocDiscountDraft["type"] }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Monto fijo ({currency})</SelectItem>
                  <SelectItem value="percentage">Porcentaje del pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{draft.type === "percentage" ? "% del pendiente" : `Monto (${currency})`}</Label>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-xs"
                value={draft.value}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                placeholder={draft.type === "percentage" ? "50" : "15"}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
            <Input
              className="h-8 text-xs"
              value={draft.reason}
              onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
              placeholder="Ej.: ingresó a mitad de mes"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Descuento: <span className="font-medium text-emerald-700 dark:text-emerald-400">−{fmt(preview.discountVes)} VES</span>
            {" · "}Queda por cobrar: <span className="font-medium">{fmt(preview.amountToPayVes)} VES</span>
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            {value && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { onClear(); setOpen(false); }}>
                Quitar
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!!error}
              onClick={() => { onApply({ ...draft, reason: draft.reason.trim() }); setOpen(false); }}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {applied && applied.discountVes > 0 && (
        <Button size="icon" variant="ghost" className="h-6 w-6" title="Quitar descuento" onClick={onClear}>
          <X className="h-3 w-3 text-destructive" />
        </Button>
      )}
    </div>
  );
}
