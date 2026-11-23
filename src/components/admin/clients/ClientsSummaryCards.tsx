import { AlertTriangle, BadgeDollarSign, Building2, Clock, FlaskConical } from "lucide-react";
import { formatUsd } from "@/lib/clients/billingMonths";
import type { ClientsOverview } from "@/lib/clients/clientBillingStatus";

interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone: string;
}

function SummaryCard({ icon: Icon, label, value, hint, tone }: SummaryCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function ClientsSummaryCards({ overview }: { overview: ClientsOverview }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryCard
        icon={Building2}
        label="Clientes reales"
        value={String(overview.clients)}
        hint={overview.inactive ? `${overview.inactive} inactivo(s)` : undefined}
        tone="bg-emerald-100 text-emerald-700"
      />
      <SummaryCard
        icon={FlaskConical}
        label="En demo"
        value={String(overview.demos)}
        hint="Oportunidades por convertir"
        tone="bg-amber-100 text-amber-700"
      />
      <SummaryCard
        icon={BadgeDollarSign}
        label="Ingreso mensual"
        value={formatUsd(overview.monthlyRevenueUsd)}
        hint="Suma de cuotas de clientes reales"
        tone="bg-blue-100 text-blue-700"
      />
      <SummaryCard
        icon={AlertTriangle}
        label="Por cobrar"
        value={formatUsd(overview.debtUsd)}
        hint={`${overview.clientsWithDebt} cliente(s) con deuda`}
        tone="bg-red-100 text-red-700"
      />
      <SummaryCard
        icon={Clock}
        label="Demos por vencer"
        value={String(overview.demosEndingSoon)}
        hint="Vencen en 7 días o ya vencieron"
        tone="bg-violet-100 text-violet-700"
      />
    </div>
  );
}
