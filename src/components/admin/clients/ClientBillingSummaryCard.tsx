import { useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientBillingSnapshot } from "@/lib/clients/clientBillingStatus";
import { formatMonthLabel, formatUsd } from "@/lib/clients/billingMonths";
import { buildReminderEmail } from "@/lib/clients/billingEmailPreview";
import { buildWhatsAppLink, buildWhatsAppReminderText } from "@/lib/clients/whatsappReminder";
import type { ClientAccount } from "@/hooks/clients/useClientAccount";
import type { ClientBillingSettings } from "@/hooks/clients/useClientBillingSettings";
import { BillingStatusBadge } from "./ClientBadges";
import { SendEmailConfirmDialog } from "./SendEmailConfirmDialog";

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
    try {
      const result = await onSendReminder();
      setConfirmOpen(false);
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
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!hasDebt || isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Ver y enviar recordatorio
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

      <SendEmailConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Enviar recordatorio de pago"
        subject={email.subject}
        html={email.html}
        recipients={recipients}
        isSending={isSending}
        onConfirm={send}
      />
    </Card>
  );
}
