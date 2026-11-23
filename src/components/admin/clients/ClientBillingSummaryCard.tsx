import { useState } from "react";
import { Eye, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientBillingSnapshot } from "@/lib/clients/clientBillingStatus";
import { formatMonthLabel, formatUsd } from "@/lib/clients/billingMonths";
import { buildReminderEmail } from "@/lib/clients/billingEmailPreview";
import { buildWhatsAppLink, buildWhatsAppReminderText } from "@/lib/clients/whatsappReminder";
import type { ClientAccount } from "@/hooks/clients/useClientAccount";
import type { ClientBillingSettings } from "@/hooks/clients/useClientBillingSettings";
import { BillingStatusBadge } from "./ClientBadges";
import { EmailPreviewDialog } from "./EmailPreviewDialog";

interface ClientBillingSummaryCardProps {
  account: ClientAccount;
  schoolName: string;
  snapshot: ClientBillingSnapshot;
  recipients: string[];
  settings: ClientBillingSettings | undefined;
  onSendReminder: () => Promise<{ recipients: string[] }>;
  isSending: boolean;
}

/** Status of the account (pending months, amount due) and the reminder actions. */
export function ClientBillingSummaryCard({
  account,
  schoolName,
  snapshot,
  recipients,
  settings,
  onSendReminder,
  isSending,
}: ClientBillingSummaryCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasDebt = snapshot.pendingMonths.length > 0;

  const email = buildReminderEmail({
    schoolName,
    contactName: account.contact_name,
    pendingMonths: hasDebt ? snapshot.pendingMonths : [],
    monthlyFeeUsd: account.monthly_fee_usd,
    paymentInstructions: settings?.payment_instructions,
    contactPhone: settings?.contact_phone,
  });

  const whatsappLink = hasDebt
    ? buildWhatsAppLink(
        account.contact_phone,
        buildWhatsAppReminderText({
          contactName: account.contact_name,
          schoolName,
          pendingMonths: snapshot.pendingMonths,
          amountDueUsd: snapshot.amountDueUsd,
        }),
      )
    : null;

  const send = async () => {
    setConfirmOpen(false);
    try {
      const result = await onSendReminder();
      toast.success(`Recordatorio enviado a ${result.recipients.join(", ")}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el recordatorio");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Estado de cobro</CardTitle>
          <BillingStatusBadge status={snapshot.status} pendingCount={snapshot.pendingMonths.length} />
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsappLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={!hasDebt}>
            <Eye className="mr-2 h-4 w-4" />
            Ver recordatorio
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!hasDebt || isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar recordatorio ahora
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Meses pendientes</p>
          {hasDebt ? (
            <p className="text-sm capitalize">{snapshot.pendingMonths.map(formatMonthLabel).join(", ")}</p>
          ) : (
            <p className="text-sm">Ninguno</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Total por cobrar</p>
          <p className={`text-lg font-bold ${hasDebt ? "text-red-600" : ""}`}>
            {snapshot.amountDueUsd != null ? formatUsd(snapshot.amountDueUsd) : "Defina la cuota"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Se le envía a</p>
          <p className="break-all text-sm">{recipients.length ? recipients.join(", ") : "Sin destinatarios"}</p>
        </div>
      </CardContent>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={email.subject}
        html={email.html}
        recipients={recipients}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar el recordatorio de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará a {recipients.length ? recipients.join(", ") : "nadie (agregue destinatarios)"} con{" "}
              {snapshot.pendingMonths.length} mes(es) pendiente(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
