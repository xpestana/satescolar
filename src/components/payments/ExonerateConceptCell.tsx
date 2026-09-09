import { useState } from "react";
import { BadgeCheck, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Lo que se perdona es **la cuota**, no un monto en bolívares: si el concepto es en USD/EUR se
 * muestra en su moneda y los VES (la conversión del día) quedan como referencia.
 */
const fmtAmount = (ves: number, original?: number | null, currency?: string | null) =>
  currency && currency !== "VES" && original != null
    ? `${fmt(original)} ${currency}`
    : fmt(ves);

const fmtAmountLong = (ves: number, original?: number | null, currency?: string | null) =>
  currency && currency !== "VES" && original != null
    ? `${fmt(original)} ${currency} (${fmt(ves)} VES)`
    : `${fmt(ves)} VES`;

/** Exoneración mostrada en la celda: la ya guardada o la que se está por aplicar en el modal. */
export interface ExonerationView {
  amount_ves: number;
  /** Pendiente perdonado en la moneda del concepto (null en cuotas en VES). */
  original_amount?: number | null;
  currency?: string | null;
  reason: string;
}

interface ExonerateConceptCellProps {
  conceptName: string;
  /** Pendiente de la cuota en VES: es lo que se perdona. */
  pendingVes: number;
  /** Ese mismo pendiente en la moneda del concepto, cuando no es VES. */
  pendingOriginal?: number | null;
  /** Moneda del concepto (`USD`, `EUR`, `VES`…). */
  currency?: string | null;
  exoneration: ExonerationView | null;
  isPending?: boolean;
  /** Solo lectura: muestra la exoneración vigente y permite quitarla, pero no aplicar una nueva. */
  readOnly?: boolean;
  onExonerate?: (reason: string) => void;
  onClear?: () => void;
  clearTitle?: string;
}

/**
 * Celda "Exoneración" de una cuota: el colegio decide que el estudiante no pagará ese concepto.
 * Se aplica al registrar el pago, junto al descuento; el estado de cuenta la muestra y permite
 * quitarla.
 */
export function ExonerateConceptCell({
  conceptName,
  pendingVes,
  pendingOriginal,
  currency,
  exoneration,
  isPending,
  readOnly,
  onExonerate,
  onClear,
  clearTitle = "Quitar exoneración",
}: ExonerateConceptCellProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (exoneration) {
    return (
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className="gap-1 whitespace-nowrap border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400"
          title={`Exonerado ${fmtAmountLong(Number(exoneration.amount_ves), exoneration.original_amount, exoneration.currency ?? currency)}: ${exoneration.reason}`}
        >
          <BadgeCheck className="h-3 w-3" />
          Exonerado {fmtAmount(Number(exoneration.amount_ves), exoneration.original_amount, exoneration.currency ?? currency)}
        </Badge>
        {onClear && (
          <Button size="icon" variant="ghost" className="h-6 w-6" title={clearTitle} disabled={isPending} onClick={onClear}>
            <Undo2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  if (readOnly || pendingVes <= 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs"
        disabled={isPending}
        onClick={() => { setReason(""); setOpen(true); }}
      >
        <BadgeCheck className="h-3 w-3" />
        Exonerar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exonerar «{conceptName}»</AlertDialogTitle>
            <AlertDialogDescription>
              El estudiante no pagará esta cuota: se perdona el pendiente completo,
              <strong> {fmtAmountLong(pendingVes, pendingOriginal, currency)}</strong>. El saldo
              queda en cero, la cuota sale de morosos y el monto <strong>no</strong> se cuenta
              como ingreso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: hijo de personal docente"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reason.trim() || isPending}
              onClick={(e) => {
                if (!reason.trim()) { e.preventDefault(); return; }
                onExonerate?.(reason.trim());
              }}
            >
              Exonerar cuota
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
