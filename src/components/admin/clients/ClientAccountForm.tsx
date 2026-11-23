import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS, type ClientAccountType } from "@/lib/clients/clientBillingStatus";
import { currentMonthKey } from "@/lib/clients/currentMonthKey";
import type { ClientAccount } from "@/hooks/clients/useClientAccount";
import type { ClientAccountUpdate } from "@/hooks/clients/useClientAccountMutations";

const TYPE_HINTS: Record<ClientAccountType, string> = {
  demo: "Está probando el sistema. No se le cobra.",
  client: "Paga mensualidad. Recibe recordatorios de cobro.",
  inactive: "Ya no es cliente. No se le cobra.",
};

interface ClientAccountFormProps {
  account: ClientAccount;
  isSaving: boolean;
  onSave: (changes: ClientAccountUpdate) => void;
}

/** Type of client (demo / real / inactive), fee, first billable month and contact person. */
export function ClientAccountForm({ account, isSaving, onSave }: ClientAccountFormProps) {
  const [type, setType] = useState<ClientAccountType>("demo");
  const [fee, setFee] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [demoEndsOn, setDemoEndsOn] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    setType(account.account_type as ClientAccountType);
    setFee(account.monthly_fee_usd != null ? String(account.monthly_fee_usd) : "");
    setStartMonth(account.billing_start_month?.slice(0, 7) ?? "");
    setDemoEndsOn(account.demo_ends_on ?? "");
    setContactName(account.contact_name ?? "");
    setContactPhone(account.contact_phone ?? "");
    setRemindersEnabled(account.reminders_enabled);
  }, [account]);

  const chooseType = (next: ClientAccountType) => {
    setType(next);
    if (next === "client" && !startMonth) setStartMonth(currentMonthKey().slice(0, 7));
  };

  const feeNumber = fee.trim() === "" ? null : Number(fee.replace(",", "."));
  const feeInvalid = feeNumber !== null && (!Number.isFinite(feeNumber) || feeNumber < 0);
  const missingForClient = type === "client" && (feeNumber === null || !startMonth);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      account_type: type,
      monthly_fee_usd: feeNumber,
      billing_start_month: startMonth ? `${startMonth}-01` : null,
      demo_ends_on: demoEndsOn || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      reminders_enabled: remindersEnabled,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos del cliente</CardTitle>
        <CardDescription>Usted decide si este colegio es cliente real o solo una demo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(ACCOUNT_TYPE_LABELS) as ClientAccountType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseType(option)}
                aria-pressed={type === option}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  type === option ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                )}
              >
                <p className="text-sm font-semibold">{ACCOUNT_TYPE_LABELS[option]}</p>
                <p className="text-xs text-muted-foreground">{TYPE_HINTS[option]}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-fee">Cuota mensual (USD)</Label>
              <Input id="client-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="120" />
              {feeInvalid && <p className="text-xs text-destructive">Monto inválido</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-start">Se cobra desde (mes)</Label>
              <Input id="client-start" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
            </div>
            {type === "demo" && (
              <div className="space-y-1.5">
                <Label htmlFor="client-demo-end">La demo vence el</Label>
                <Input id="client-demo-end" type="date" value={demoEndsOn} onChange={(e) => setDemoEndsOn(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="client-contact">Persona de contacto</Label>
              <Input id="client-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Lcda. ..." />
              <p className="text-xs text-muted-foreground">Se usa en el saludo de los correos.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-phone">Teléfono / WhatsApp</Label>
              <Input id="client-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="0414-0000000" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="client-reminders">Recordatorios automáticos</Label>
              <p className="text-xs text-muted-foreground">Envía el recordatorio en los días configurados si hay meses pendientes.</p>
            </div>
            <Switch id="client-reminders" checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
          </div>

          {missingForClient && (
            <p className="text-sm text-orange-600">Para cobrar a un cliente real indique la cuota y el mes desde el que se cobra.</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving || feeInvalid}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
