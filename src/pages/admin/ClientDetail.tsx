import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Blocks, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/components/ui/loading-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientTypeBadge } from "@/components/admin/clients/ClientBadges";
import { ClientBillingSummaryCard } from "@/components/admin/clients/ClientBillingSummaryCard";
import { ClientPaymentsPanel } from "@/components/admin/clients/ClientPaymentsPanel";
import { ClientAccountForm } from "@/components/admin/clients/ClientAccountForm";
import { ClientRecipientsCard } from "@/components/admin/clients/ClientRecipientsCard";
import { ClientObservationsCard } from "@/components/admin/clients/ClientObservationsCard";
import { ClientEmailHistory } from "@/components/admin/clients/ClientEmailHistory";
import { useClientAccount, useClientEmailLog } from "@/hooks/clients/useClientAccount";
import { useClientAccountMutations, type ClientAccountUpdate } from "@/hooks/clients/useClientAccountMutations";
import { useClientBillingSettings } from "@/hooks/clients/useClientBillingSettings";
import { useSchoolOwnerContacts } from "@/hooks/clients/useSchoolOwnerContacts";
import { summarizeClientBilling } from "@/lib/clients/clientBillingStatus";
import { currentMonthKey } from "@/lib/clients/currentMonthKey";
import { collectBillingRecipients } from "@/lib/clients/billingEmailPreview";

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useClientAccount(id);
  const { data: emails = [] } = useClientEmailLog(id);
  const { data: ownersBySchool } = useSchoolOwnerContacts();
  const { settings } = useClientBillingSettings();
  const mutations = useClientAccountMutations(id);
  const currentMonth = currentMonthKey();

  const owners = data ? ownersBySchool?.get(data.school.id) ?? [] : [];
  const recipients = data
    ? collectBillingRecipients({ ownerEmails: owners.map((o) => o.email), notifyOwner: data.account.notify_owner, contacts: data.contacts })
    : [];
  const snapshot = useMemo(
    () =>
      data
        ? summarizeClientBilling({
            accountType: data.account.account_type,
            startMonth: data.account.billing_start_month,
            monthlyFeeUsd: data.account.monthly_fee_usd,
            settledMonths: data.payments.map((p) => p.period_month),
            currentMonth,
          })
        : null,
    [data, currentMonth],
  );

  const saveAccount = async (changes: ClientAccountUpdate, success: string) => {
    try {
      await mutations.updateAccount.mutateAsync(changes);
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar"));
    }
  };

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err, failure));
      throw err;
    }
  };

  const schoolName = data?.school.name ?? "";

  return (
    <DashboardLayout>
      <PageHeader
        title={schoolName ? `Cliente · ${schoolName}` : "Cliente"}
        description="Tipo de cliente, meses pagados, destinatarios de cobro y observaciones."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Clientes y Cobros", href: "/admin/clientes" },
          { label: schoolName || "Cliente" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link to="/admin/clientes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a clientes
          </Link>
        </Button>
        {data && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/admin/colegios/${data.school.id}/modulos`}>
                <Blocks className="mr-2 h-4 w-4" />
                Módulos
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/admin/colegios/${data.school.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar colegio
              </Link>
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>No se pudo cargar el cliente.</AlertDescription>
        </Alert>
      )}
      {isLoading && <FormSkeleton fields={6} />}
      {!isLoading && !error && !data && (
        <Alert className="mb-4">
          <AlertDescription>Cliente no encontrado.</AlertDescription>
        </Alert>
      )}

      {data && snapshot && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {data.school.logo_url && <AvatarImage src={data.school.logo_url} alt={schoolName} />}
              <AvatarFallback>{schoolName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
                {schoolName} <ClientTypeBadge type={data.account.account_type} />
              </p>
              <p className="text-sm text-muted-foreground">
                {[data.school.rif, data.school.email, data.school.phone].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <ClientBillingSummaryCard
            account={data.account}
            schoolName={schoolName}
            snapshot={snapshot}
            recipients={recipients}
            settings={settings}
            onSendReminder={() => mutations.sendReminder.mutateAsync()}
            isSending={mutations.sendReminder.isPending}
          />

          <Tabs defaultValue={data.account.account_type === "client" && data.account.billing_start_month ? "payments" : "data"}>
            <TabsList className="mb-4">
              <TabsTrigger value="payments">Meses y pagos</TabsTrigger>
              <TabsTrigger value="data">Datos y destinatarios</TabsTrigger>
              <TabsTrigger value="emails">Correos enviados ({emails.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="payments">
              <ClientPaymentsPanel
                account={data.account}
                schoolName={schoolName}
                payments={data.payments}
                currentMonth={currentMonth}
                recipients={recipients}
                isSaving={mutations.registerPayment.isPending}
                onRegister={(input) => mutations.registerPayment.mutateAsync(input)}
                onRemovePayment={(p) =>
                  run(() => mutations.removePayment.mutateAsync(p.id), "Registro eliminado", "No se pudo eliminar").catch(() => undefined)
                }
              />
            </TabsContent>

            <TabsContent value="data">
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-6">
                  <ClientAccountForm
                    account={data.account}
                    isSaving={mutations.updateAccount.isPending}
                    onSave={(changes) => saveAccount(changes, "Datos del cliente guardados")}
                  />
                  <ClientObservationsCard
                    value={data.account.observations}
                    isSaving={mutations.updateAccount.isPending}
                    onSave={(observations) => saveAccount({ observations }, "Observaciones guardadas")}
                  />
                </div>
                <ClientRecipientsCard
                  owners={owners}
                  notifyOwner={data.account.notify_owner}
                  contacts={data.contacts}
                  isAdding={mutations.addContact.isPending}
                  onNotifyOwnerChange={(notify_owner) =>
                    saveAccount(
                      { notify_owner },
                      notify_owner ? "El usuario principal recibirá los cobros" : "El usuario principal ya no recibirá los cobros",
                    )
                  }
                  onAddContact={(contact) =>
                    run(() => mutations.addContact.mutateAsync(contact), "Correo agregado", "No se pudo agregar el correo")
                  }
                  onToggleContact={(contactId, isActive) =>
                    run(
                      () => mutations.setContactActive.mutateAsync({ id: contactId, isActive }),
                      isActive ? "Envío reanudado" : "Envío pausado",
                      "No se pudo actualizar",
                    ).catch(() => undefined)
                  }
                  onRemoveContact={(contactId) =>
                    run(() => mutations.removeContact.mutateAsync(contactId), "Correo eliminado", "No se pudo eliminar").catch(
                      () => undefined,
                    )
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="emails">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <ClientEmailHistory emails={emails} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </DashboardLayout>
  );
}
