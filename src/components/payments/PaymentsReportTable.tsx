import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateOnly } from "@/lib/dateUtils";
import {
  ROW_KIND_LABELS,
  type PaymentReportRow,
  type PaymentsReportSortKey,
  type SortDirection,
} from "@/lib/paymentsReport";

const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Column {
  key: PaymentsReportSortKey | null;
  label: string;
  className?: string;
}

/** Columnas de la tabla; `key` no nulo = se puede ordenar por ella. */
const COLUMNS: Column[] = [
  { key: "invoiceNumber", label: "Factura" },
  { key: null, label: "Control" },
  { key: "paymentDate", label: "Fecha" },
  { key: null, label: "Tipo" },
  { key: "studentName", label: "Estudiante" },
  { key: null, label: "Grado" },
  { key: "familyName", label: "Familia" },
  { key: "planName", label: "Plan" },
  { key: "conceptName", label: "Concepto" },
  { key: "amountVes", label: "Monto (VES)", className: "text-right" },
  { key: null, label: "Descuento", className: "text-right" },
  { key: null, label: "Exonerado", className: "text-right" },
  { key: "paymentTotalVes", label: "Total factura", className: "text-right" },
  { key: null, label: "Métodos" },
  { key: null, label: "Referencia" },
  { key: "status", label: "Estado" },
  { key: null, label: "Factura", className: "text-right" },
];

const KIND_BADGE: Record<string, string> = {
  cuota: "",
  otros: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  exoneracion: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

interface Props {
  rows: PaymentReportRow[];
  sortKey: PaymentsReportSortKey;
  sortDirection: SortDirection;
  onSort: (key: PaymentsReportSortKey) => void;
  /** Imprime la factura sobre el formato preimpreso del colegio (plantilla de /formatos). */
  onPrintInvoice: (paymentId: string) => void;
  /** Descarga el recibo propio del sistema en PDF. */
  onDownloadReceipt: (paymentId: string) => void;
}

/** Tabla del Reporte de Pagos: una fila por línea, con orden por columna. */
export function PaymentsReportTable({
  rows, sortKey, sortDirection, onSort, onPrintInvoice, onDownloadReceipt,
}: Props) {
  const sortIcon = (key: PaymentsReportSortKey | null) => {
    if (!key) return null;
    if (key !== sortKey) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead key={col.label} className={`whitespace-nowrap ${col.className || ""}`}>
                {col.key ? (
                  <Button
                    variant="ghost"
                    className="-ml-2 h-7 px-2 text-xs font-medium"
                    onClick={() => onSort(col.key!)}
                  >
                    {col.label}
                    {sortIcon(col.key)}
                  </Button>
                ) : col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-sm text-muted-foreground">
                No hay pagos que coincidan con la búsqueda.
              </TableCell>
            </TableRow>
          ) : rows.map((row) => (
            <TableRow key={row.id} className={row.status === "voided" ? "opacity-60" : ""}>
              <TableCell className="whitespace-nowrap font-medium">{row.invoiceNumber || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.controlNumber || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{row.paymentDate ? formatDateOnly(row.paymentDate) : "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`whitespace-nowrap text-xs ${KIND_BADGE[row.kind] || ""}`}>
                  {ROW_KIND_LABELS[row.kind]}
                </Badge>
              </TableCell>
              <TableCell className="min-w-[180px]">
                <div className="font-medium">{row.studentName || "—"}</div>
                {row.studentDocument && <div className="text-xs text-muted-foreground">{row.studentDocument}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{row.gradeLabel || "—"}</TableCell>
              <TableCell className="min-w-[160px]">
                <div>{row.familyName || "—"}</div>
                {row.holderName && <div className="text-xs text-muted-foreground">{row.holderName}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{row.planName || "—"}</TableCell>
              <TableCell className="min-w-[160px]">
                <div>{row.conceptName || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {row.conceptType || "—"}
                  {row.conceptCurrency !== "VES" && row.originalAmount != null &&
                    ` · ${fmt(row.originalAmount)} ${row.conceptCurrency}`}
                  {row.kind === "cuota" && row.isPartial && " · parcial"}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium">{fmt(row.amountVes)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {row.discountVes > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400" title={row.discountReason}>
                    −{fmt(row.discountVes)}
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {row.exoneratedVes > 0 ? (
                  <span className="text-purple-700 dark:text-purple-400" title={row.exonerationReason}>
                    {fmt(row.exoneratedVes)}
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                {row.paymentId ? fmt(row.paymentTotalVes) : "—"}
              </TableCell>
              <TableCell className="min-w-[160px] text-xs">
                <div>{row.methodsLabel || "—"}</div>
                {row.banks && <div className="text-muted-foreground">{row.banks}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{row.references || "—"}</TableCell>
              <TableCell>
                <Badge variant={row.status === "voided" ? "destructive" : "default"} className="whitespace-nowrap">
                  {row.status === "voided" ? "Anulado" : "Completado"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {row.paymentId ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Imprimir factura en el formato del colegio"
                      onClick={() => onPrintInvoice(row.paymentId!)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Descargar recibo en PDF"
                      onClick={() => onDownloadReceipt(row.paymentId!)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
