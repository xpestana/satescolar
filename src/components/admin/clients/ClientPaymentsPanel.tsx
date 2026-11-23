import { useMemo, useState } from "react";
import { CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gridMonths, monthCellState } from "@/lib/clients/clientBillingStatus";
import { pendingMonths } from "@/lib/clients/billingMonths";
import type { ClientAccount, ClientPayment } from "@/hooks/clients/useClientAccount";
import type { RegisterPaymentInput, RegisterPaymentResult } from "@/hooks/clients/useClientAccountMutations";
import { ClientMonthsGrid } from "./ClientMonthsGrid";
import { ClientPaymentsHistory } from "./ClientPaymentsHistory";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";

interface ClientPaymentsPanelProps {
  account: ClientAccount;
  schoolName: string;
  payments: ClientPayment[];
  currentMonth: string;
  recipients: string[];
  isSaving: boolean;
  onRegister: (input: RegisterPaymentInput) => Promise<RegisterPaymentResult>;
  onRemovePayment: (payment: ClientPayment) => void;
}

/** Month grid (select several months) + register dialog + history of recorded months. */
export function ClientPaymentsPanel({
  account,
  schoolName,
  payments,
  currentMonth,
  recipients,
  isSaving,
  onRegister,
  onRemovePayment,
}: ClientPaymentsPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const settled = useMemo(
    () => new Map(payments.map((p) => [p.period_month, p.status as "paid" | "waived"])),
    [payments],
  );
  const months = useMemo(() => gridMonths(account.billing_start_month, currentMonth), [account.billing_start_month, currentMonth]);
  const stateOf = (month: string) => monthCellState(month, settled, account.billing_start_month, currentMonth);
  const pending = months.filter((m) => stateOf(m) === "pending");
  const selectedMonths = [...selected].sort();

  const remainingAfter = pendingMonths({
    startMonth: account.billing_start_month,
    currentMonth,
    settledMonths: [...settled.keys(), ...selectedMonths],
  });

  const toggle = (month: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  const submit = async (input: RegisterPaymentInput) => {
    try {
      const result = await onRegister(input);
      setDialogOpen(false);
      setSelected(new Set());
      const saved = `${result.saved} mes(es) registrado(s)`;
      if (!result.email) toast.success(saved);
      else if (result.email.sent) toast.success(`${saved}. Agradecimiento enviado a ${result.email.recipients.join(", ")}`);
      else toast.warning(`${saved}, pero el correo no salió: ${result.email.error ?? "error desconocido"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el pago");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Meses</CardTitle>
            <CardDescription>
              Seleccione uno o varios meses y pulse «Registrar». Puede marcar meses futuros si pagan por adelantado.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set(pending))}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Seleccionar pendientes
              </Button>
            )}
            {selected.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            )}
            <Button size="sm" disabled={selected.size === 0} onClick={() => setDialogOpen(true)}>
              Registrar {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!account.billing_start_month && (
            <p className="mb-4 rounded-md bg-orange-50 p-3 text-sm text-orange-700">
              Aún no se ha indicado desde qué mes se cobra: defínalo en «Datos del cliente» para calcular la deuda.
            </p>
          )}
          <ClientMonthsGrid months={months} stateOf={stateOf} selected={selected} onToggle={toggle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientPaymentsHistory payments={payments} onRemove={onRemovePayment} />
        </CardContent>
      </Card>

      <RegisterPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        months={selectedMonths}
        monthlyFeeUsd={account.monthly_fee_usd}
        schoolName={schoolName}
        contactName={account.contact_name}
        remainingAfter={remainingAfter}
        recipients={recipients}
        isSaving={isSaving}
        onSubmit={submit}
      />
    </div>
  );
}
