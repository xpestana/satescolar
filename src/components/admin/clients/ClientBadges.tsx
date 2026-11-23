import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_TYPE_LABELS,
  BILLING_STATUS_LABELS,
  isClientAccountType,
  type BillingStatus,
} from "@/lib/clients/clientBillingStatus";

const TYPE_STYLES: Record<string, string> = {
  client: "bg-emerald-100 text-emerald-800 border-emerald-200",
  demo: "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_STYLES: Record<BillingStatus, string> = {
  up_to_date: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending: "bg-red-100 text-red-800 border-red-200",
  not_configured: "bg-orange-100 text-orange-800 border-orange-200",
  demo: "bg-amber-50 text-amber-700 border-amber-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ClientTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TYPE_STYLES[type])}>
      {isClientAccountType(type) ? ACCOUNT_TYPE_LABELS[type] : type}
    </Badge>
  );
}

export function BillingStatusBadge({ status, pendingCount }: { status: BillingStatus; pendingCount?: number }) {
  const label =
    status === "pending" && pendingCount
      ? `Debe ${pendingCount} ${pendingCount === 1 ? "mes" : "meses"}`
      : BILLING_STATUS_LABELS[status];
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
      {label}
    </Badge>
  );
}
