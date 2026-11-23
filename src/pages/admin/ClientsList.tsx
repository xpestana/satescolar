import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { ClientsSummaryCards } from "@/components/admin/clients/ClientsSummaryCards";
import { ClientsTable } from "@/components/admin/clients/ClientsTable";
import { BillingSettingsDialog } from "@/components/admin/clients/BillingSettingsDialog";
import { useClientAccounts, type ClientListItem } from "@/hooks/clients/useClientAccounts";
import { summarizeClients } from "@/lib/clients/clientBillingStatus";
import { todayCaracasIso } from "@/lib/dateUtils";

type Filter = "all" | "client" | "debt" | "demo" | "inactive";

const FILTERS: Record<Filter, (item: ClientListItem) => boolean> = {
  all: () => true,
  client: (i) => i.accountType === "client",
  debt: (i) => i.snapshot.status === "pending",
  demo: (i) => i.accountType === "demo",
  inactive: (i) => i.accountType === "inactive",
};

export default function ClientsList() {
  const { items, isLoading, error } = useClientAccounts();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const overview = useMemo(
    () =>
      summarizeClients(
        items.map((i) => ({
          accountType: i.accountType,
          monthlyFeeUsd: i.monthlyFeeUsd,
          snapshot: i.snapshot,
          demoEndsOn: i.demoEndsOn,
        })),
        todayCaracasIso(),
      ),
    [items],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter(FILTERS[filter])
      .filter(
        (i) =>
          !term ||
          [i.schoolName, i.contactName, i.schoolEmail, ...i.owners.map((o) => o.email)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
      );
  }, [items, filter, search]);

  const count = (f: Filter) => items.filter(FILTERS[f]).length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Clientes y Cobros"
        description="Controla qué colegios son clientes, cuánto pagan, qué meses deben y a quién se le cobra."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Clientes y Cobros" }]}
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>No se pudieron cargar los clientes.</AlertDescription>
        </Alert>
      )}

      {!isLoading && <ClientsSummaryCards overview={overview} />}

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="all">Todos ({count("all")})</TabsTrigger>
              <TabsTrigger value="client">Clientes ({count("client")})</TabsTrigger>
              <TabsTrigger value="debt">Con deuda ({count("debt")})</TabsTrigger>
              <TabsTrigger value="demo">Demos ({count("demo")})</TabsTrigger>
              <TabsTrigger value="inactive">Inactivos ({count("inactive")})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar colegio, contacto o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 sm:w-72"
              />
            </div>
            <BillingSettingsDialog />
          </div>
        </div>

        {isLoading ? <TableSkeleton rows={6} columns={6} /> : <ClientsTable items={visible} />}
      </div>
    </DashboardLayout>
  );
}
