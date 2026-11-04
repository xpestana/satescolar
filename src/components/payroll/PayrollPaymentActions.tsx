import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollPayments, type PayrollPaymentRow } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollRecalculate } from "@/hooks/payroll/usePayrollRecalculate";

interface PayrollPaymentActionsProps {
  schoolId: string;
  payment: PayrollPaymentRow;
  canApprove: boolean;
  /** Suppliers may void a paid payment, as long as its withholdings weren't declared. */
  allowVoidPaid?: boolean;
}

/** Approve → pay → void of a payment, shared by the staff and supplier lists. */
export function PayrollPaymentActions({ schoolId, payment, canApprove, allowVoidPaid = false }: PayrollPaymentActionsProps) {
  const { toast } = useToast();
  const { approvePayment, markPaid, voidPayment } = usePayrollPayments(schoolId);
  const recalculate = usePayrollRecalculate(schoolId);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [recalculateOpen, setRecalculateOpen] = useState(false);

  const showError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  const handlePay = () => {
    markPaid.mutate(
      { paymentId: payment.id },
      {
        onSuccess: ({ emailSent }) =>
          toast({
            title: "Pago marcado como pagado",
            description: emailSent ? "Se envió el recibo por correo." : "No se pudo enviar el recibo por correo.",
          }),
        onError: (e: Error) => {
          // A percentage changed after this payment was registered: never adjust it silently.
          if ((e as Error & { code?: string }).code === "WITHHOLDING_RATE_CHANGED") setRecalculateOpen(true);
          else showError(e);
        },
      }
    );
  };

  const confirmVoid = () => {
    if (!voidReason.trim()) {
      toast({ title: "Indique el motivo de la anulación", variant: "destructive" });
      return;
    }
    voidPayment.mutate(
      { paymentId: payment.id, reason: voidReason.trim() },
      {
        onSuccess: () => {
          toast({ title: "Pago anulado" });
          setVoidOpen(false);
          setVoidReason("");
        },
        onError: showError,
      }
    );
  };

  const confirmRecalculate = () => {
    recalculate.mutate(payment, {
      onSuccess: () => {
        toast({ title: "Pago recalculado", description: "Quedó en borrador y debe aprobarse otra vez." });
        setRecalculateOpen(false);
      },
      onError: showError,
    });
  };

  const canVoid = payment.status !== "voided" && (payment.status !== "paid" || allowVoidPaid);

  return (
    <>
      <div className="flex gap-1 flex-wrap">
        {payment.status === "draft" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canApprove || approvePayment.isPending}
            onClick={() =>
              approvePayment.mutate(payment.id, {
                onSuccess: () => toast({ title: "Pago aprobado" }),
                onError: showError,
              })
            }
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />Aprobar
          </Button>
        )}
        {payment.status === "approved" && (
          <Button size="sm" disabled={!canApprove || markPaid.isPending} onClick={handlePay}>
            {markPaid.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />}
            Pagar
          </Button>
        )}
        {canVoid && (
          <Button size="sm" variant="ghost" disabled={!canApprove} title="Anular" onClick={() => setVoidOpen(true)}>
            <Ban className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>

      <Dialog open={voidOpen} onOpenChange={(v) => { setVoidOpen(v); if (!v) setVoidReason(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Anular pago</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo de la anulación *</Label>
            <Textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Indique por qué se anula este pago" />
            {payment.status === "paid" && (
              <p className="text-xs text-muted-foreground">Sus comprobantes quedarán anulados y sus números no se reutilizan.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmVoid} disabled={voidPayment.isPending}>
              {voidPayment.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recalculateOpen} onOpenChange={setRecalculateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiaron los porcentajes</DialogTitle>
            <DialogDescription>
              Este pago se registró con porcentajes que ya no están vigentes. Al recalcularlo puede cambiar el neto, así
              que volverá a borrador y deberá aprobarse otra vez.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecalculateOpen(false)}>Ahora no</Button>
            <Button onClick={confirmRecalculate} disabled={recalculate.isPending}>
              {recalculate.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Recalcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
