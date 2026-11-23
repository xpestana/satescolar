import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMonthList } from "@/lib/clients/billingMonths";
import type { ClientEmailLog } from "@/hooks/clients/useClientAccount";

const KIND_LABELS: Record<string, string> = { reminder: "Recordatorio", thanks: "Agradecimiento" };

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClientEmailHistory({ emails }: { emails: ClientEmailLog[] }) {
  if (emails.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Aún no se han enviado correos de cobro.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Meses</TableHead>
            <TableHead>Destinatarios</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDateTime(e.sent_at)}
                <span className="block text-xs text-muted-foreground">{e.triggered_by === "cron" ? "Automático" : "Manual"}</span>
              </TableCell>
              <TableCell>{KIND_LABELS[e.kind] ?? e.kind}</TableCell>
              <TableCell className="text-sm">{formatMonthList(e.months)}</TableCell>
              <TableCell className="max-w-[260px] break-all text-sm">{e.recipients.join(", ") || "—"}</TableCell>
              <TableCell>
                {e.status === "sent" ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Enviado</Badge>
                ) : (
                  <div>
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">Falló</Badge>
                    {e.error_message && <p className="mt-1 text-xs text-muted-foreground">{e.error_message}</p>}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
