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
import type { ConceptExoneration } from "@/hooks/payments/useConceptExonerations";

const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ExonerateConceptCellProps {
  conceptName: string;
  /** Pendiente de la cuota en VES (lo que se perdonaría). */
  pendingVes: number;
  /** Exoneración vigente sobre esta cuota, si la hay. */
  exoneration: ConceptExoneration | null;
  isPending?: boolean;
  onExonerate: (reason: string) => void;
  onRevert: () => void;
}

/**
 * Acción "Exonerar" de una cuota en el estado de cuenta: el colegio perdona el pendiente
 * completo (beca, hijo de personal, caso social). No genera pago ni factura.
 */
export function ExonerateConceptCell({
  conceptName,
  pendingVes,
  exoneration,
  isPending,
  onExonerate,
  onRevert,
}: ExonerateConceptCellProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (exoneration) {
    return (
      <div className="flex items-center gap-1">
        <Badge
          variant="outline"
          className="gap-1 border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400"
          title={`Exonerado: ${exoneration.reason}`}
        >
          <BadgeCheck className="h-3 w-3" />
          Exonerado {fmt(Number(exoneration.amount_ves))}
        </Badge>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title="Quitar exoneración"
          disabled={isPending}
          onClick={onRevert}
        >
          <Undo2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (pendingVes <= 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={isPending} onClick={() => { setReason(""); setOpen(true); }}>
        <BadgeCheck className="h-3 w-3" />
        Exonerar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exonerar «{conceptName}»</AlertDialogTitle>
            <AlertDialogDescription>
              Se perdona el pendiente completo de esta cuota: <strong>{fmt(pendingVes)} VES</strong>.
              El saldo queda en cero, la cuota sale de morosos y el monto <strong>no</strong> se
              cuenta como ingreso. Puede revertirse después.
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
                onExonerate(reason.trim());
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
