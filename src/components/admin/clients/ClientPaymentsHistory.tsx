import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateOnly } from "@/lib/dateUtils";
import { formatMonthLabel, formatUsd } from "@/lib/clients/billingMonths";
import type { ClientPayment } from "@/hooks/clients/useClientAccount";

interface ClientPaymentsHistoryProps {
  payments: ClientPayment[];
  onRemove: (payment: ClientPayment) => void;
}

export function ClientPaymentsHistory({ payments, onRemove }: ClientPaymentsHistoryProps) {
  if (payments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay meses registrados.</p>;
  }

  const totalPaid = payments.reduce((sum, p) => sum + (p.status === "paid" ? Number(p.amount_usd ?? 0) : 0), 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Total cobrado registrado: <strong className="text-foreground">{formatUsd(totalPaid)}</strong>
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Método / Referencia</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium capitalize">{formatMonthLabel(p.period_month)}</TableCell>
                <TableCell>
                  {p.status === "paid" ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Pagado</Badge>
                  ) : (
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">Exonerado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{p.amount_usd != null ? formatUsd(p.amount_usd) : "—"}</TableCell>
                <TableCell>{formatDateOnly(p.paid_on)}</TableCell>
                <TableCell className="text-sm">
                  {[p.method, p.reference].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={p.notes ?? ""}>
                  {p.notes || "—"}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Quitar registro">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar {formatMonthLabel(p.period_month)}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          El mes volverá a quedar pendiente. No se envía ningún correo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemove(p)}>Quitar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
