import { Link } from "react-router-dom";
import { BellOff, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateOnly } from "@/lib/dateUtils";
import { formatMonthLabel, formatUsd } from "@/lib/clients/billingMonths";
import type { ClientListItem } from "@/hooks/clients/useClientAccounts";
import { BillingStatusBadge, ClientTypeBadge } from "./ClientBadges";
import { ClientObservationsPopover } from "./ClientObservationsPopover";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function ClientsTable({ items }: { items: ClientListItem[] }) {
  if (items.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">No hay clientes que coincidan con el filtro.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colegio</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado de cobro</TableHead>
          <TableHead className="text-right">Cuota</TableHead>
          <TableHead className="text-right">Por cobrar</TableHead>
          <TableHead>Observaciones</TableHead>
          <TableHead>Destinatarios</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const recipients = (item.notifyOwner ? item.owners.length : 0) + item.activeContacts;
          return (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <Link to={`/admin/clientes/${item.id}`} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {item.logoUrl && <AvatarImage src={item.logoUrl} alt={item.schoolName} />}
                    <AvatarFallback className="text-xs">{initials(item.schoolName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{item.schoolName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.contactName || item.owners[0]?.fullName || item.schoolEmail || "Sin contacto"}
                    </p>
                  </div>
                </Link>
              </TableCell>
              <TableCell>
                <ClientTypeBadge type={item.accountType} />
                {item.accountType === "demo" && item.demoEndsOn && (
                  <p className="mt-1 text-xs text-muted-foreground">Vence {formatDateOnly(item.demoEndsOn)}</p>
                )}
              </TableCell>
              <TableCell>
                <BillingStatusBadge status={item.snapshot.status} pendingCount={item.snapshot.pendingMonths.length} />
                {item.snapshot.status === "pending" && (
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    Desde {formatMonthLabel(item.snapshot.pendingMonths[0])}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">{item.monthlyFeeUsd != null ? formatUsd(item.monthlyFeeUsd) : "—"}</TableCell>
              <TableCell className="text-right font-medium">
                {item.accountType === "client" && item.snapshot.amountDueUsd ? (
                  <span className="text-red-600">{formatUsd(item.snapshot.amountDueUsd)}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <ClientObservationsPopover
                  accountId={item.id}
                  schoolName={item.schoolName}
                  observations={item.observations}
                />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-sm">
                  {recipients}
                  {!item.remindersEnabled && item.accountType === "client" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Recordatorios automáticos pausados</TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </TableCell>
              <TableCell>
                <Link to={`/admin/clientes/${item.id}`} aria-label={`Abrir ${item.schoolName}`}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
