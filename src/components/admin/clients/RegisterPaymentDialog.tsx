import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayCaracasIso } from "@/lib/dateUtils";
import { formatMonthList, formatUsd } from "@/lib/clients/billingMonths";
import { buildThanksEmail } from "@/lib/clients/billingEmailPreview";
import type { RegisterPaymentInput } from "@/hooks/clients/useClientAccountMutations";
import { EmailPreviewDialog } from "./EmailPreviewDialog";

const METHODS = ["Pago móvil", "Transferencia", "Zelle", "Binance / USDT", "Efectivo", "Otro"];

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  months: string[];
  monthlyFeeUsd: number | null;
  schoolName: string;
  contactName: string | null;
  remainingAfter: string[];
  recipients: string[];
  isSaving: boolean;
  onSubmit: (input: RegisterPaymentInput) => void;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  months,
  monthlyFeeUsd,
  schoolName,
  contactName,
  remainingAfter,
  recipients,
  isSaving,
  onSubmit,
}: RegisterPaymentDialogProps) {
  const [status, setStatus] = useState<"paid" | "waived">("paid");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayCaracasIso());
  const [method, setMethod] = useState("Pago móvil");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [sendThanks, setSendThanks] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus("paid");
    setAmount(monthlyFeeUsd != null ? String(monthlyFeeUsd) : "");
    setPaidOn(todayCaracasIso());
    setReference("");
    setNotes("");
    setSendThanks(true);
  }, [open, monthlyFeeUsd]);

  const amountNumber = amount.trim() === "" ? null : Number(amount.replace(",", "."));
  const amountInvalid = amountNumber !== null && (!Number.isFinite(amountNumber) || amountNumber < 0);
  const willSendThanks = status === "paid" && sendThanks;
  const thanks = buildThanksEmail({ schoolName, contactName, paidMonths: months, remainingMonths: remainingAfter });

  const submit = () =>
    onSubmit({
      months,
      status,
      amountUsdPerMonth: status === "paid" ? amountNumber : null,
      paidOn,
      method: status === "paid" ? method : "",
      reference,
      notes,
      sendThanks: willSendThanks,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar meses</DialogTitle>
          <DialogDescription className="first-letter:uppercase">{formatMonthList(months)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={status} onValueChange={(v) => setStatus(v as "paid" | "waived")} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="paid" id="status-paid" />
              <Label htmlFor="status-paid">Pagado</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="waived" id="status-waived" />
              <Label htmlFor="status-waived">Exonerado (no se cobra)</Label>
            </div>
          </RadioGroup>

          {status === "paid" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amount">Monto por mes (USD)</Label>
                  <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  {amountNumber != null && !amountInvalid && months.length > 1 && (
                    <p className="text-xs text-muted-foreground">Total: {formatUsd(amountNumber * months.length)}</p>
                  )}
                  {amountInvalid && <p className="text-xs text-destructive">Monto inválido</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">Fecha de pago</Label>
                  <Input id="pay-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Método</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-ref">Referencia</Label>
                  <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Nota (opcional)</Label>
            <Textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {status === "paid" && (
            <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-start gap-2">
                <Checkbox id="send-thanks" checked={sendThanks} onCheckedChange={(v) => setSendThanks(v === true)} />
                <div>
                  <Label htmlFor="send-thanks">Enviar correo de agradecimiento</Label>
                  <p className="text-xs text-muted-foreground">
                    {recipients.length ? `A: ${recipients.join(", ")}` : "No hay destinatarios configurados"}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-1 h-4 w-4" />
                Ver
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isSaving || amountInvalid || months.length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar{willSendThanks ? " y enviar" : ""}
          </Button>
        </DialogFooter>

        <EmailPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          subject={thanks.subject}
          html={thanks.html}
          recipients={recipients}
        />
      </DialogContent>
    </Dialog>
  );
}
