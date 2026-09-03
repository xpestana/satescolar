import { Fragment, useState } from "react";
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown, Download, Printer,
} from "lucide-react";
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
  // Las acciones van primero: imprimir la factura es lo que más se hace desde este reporte
  { key: null, label: "Acciones" },
  { key: null, label: "" },
  { key: "invoiceNumber", label: "Factura" },
  { key: "paymentDate", label: "Fecha" },
  { key: "familyName", label: "Familia" },
  { key: "studentsLabel", label: "Estudiantes" },
  { key: "conceptsLabel", label: "Conceptos" },
  { key: "plansLabel", label: "Plan" },
  { key: "paymentTotalVes", label: "Total (VES)", className: "text-right" },
  { key: null, label: "Descuento", className: "text-right" },
  { key: null, label: "Exonerado", className: "text-right" },
  { key: null, label: "Métodos" },
  { key: "status", label: "Estado" },
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

/**
 * Tabla del Reporte de Pagos: **una fila por factura**, con el detalle de cuotas, estudiantes
 * y formas de pago desplegable.
 */
export function PaymentsReportTable({
  rows, sortKey, sortDirection, onSort, onPrintInvoice, onDownloadReceipt,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

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
            {COLUMNS.map((col, i) => (
              <TableHead key={col.label || `col-${i}`} className={`whitespace-nowrap ${col.className || ""}`}>
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
            <Fragment key={row.id}>
              <TableRow className={row.status === "voided" ? "opacity-60" : ""}>
                <TableCell>
                  {row.paymentId ? (
                    <div className="flex gap-1">
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
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title={expanded[row.id] ? "Ocultar detalle" : "Ver detalle"}
                    onClick={() => toggle(row.id)}
                  >
                    {expanded[row.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="font-medium">{row.invoiceNumber || "—"}</div>
                  {row.controlNumber && <div className="text-xs text-muted-foreground">Ctrl. {row.controlNumber}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.paymentDate ? formatDateOnly(row.paymentDate) : "—"}</TableCell>
                <TableCell className="min-w-[160px]">
                  <div>{row.familyName || "—"}</div>
                  {row.holderName && <div className="text-xs text-muted-foreground">{row.holderName}</div>}
                </TableCell>
                <TableCell className="min-w-[200px]">
                  {row.studentNames.length === 0 ? "—" : (
                    <>
                      <div>{row.studentNames.join(" · ")}</div>
                      {row.gradesLabel && <div className="text-xs text-muted-foreground">{row.gradesLabel}</div>}
                    </>
                  )}
                </TableCell>
                <TableCell className="min-w-[200px]">
                  <div className="text-sm">{row.conceptsLabel || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.lines.length} concepto(s){row.hasPartial ? " · parcial" : ""}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{row.plansLabel || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium">
                  {row.paymentId ? fmt(row.paymentTotalVes) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {row.discountVes > 0
                    ? <span className="text-emerald-700 dark:text-emerald-400">−{fmt(row.discountVes)}</span>
                    : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {row.exoneratedVes > 0
                    ? <span className="text-purple-700 dark:text-purple-400">{fmt(row.exoneratedVes)}</span>
                    : "—"}
                </TableCell>
                <TableCell className="min-w-[150px] text-xs">
                  <div>{row.methodsLabel || "—"}</div>
                  {row.references && <div className="text-muted-foreground">Ref: {row.references}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "voided" ? "destructive" : "default"} className="whitespace-nowrap">
                    {row.status === "voided" ? "Anulado" : "Completado"}
                  </Badge>
                </TableCell>
              </TableRow>

              {expanded[row.id] && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={COLUMNS.length} className="py-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold">Conceptos de la factura</p>
                        {row.lines.map((line) => (
                          <div key={line.id} className="flex items-start justify-between gap-3 border-b py-1 text-xs">
                            <span>
                              <Badge variant="outline" className={`mr-2 text-[10px] ${KIND_BADGE[line.kind] || ""}`}>
                                {ROW_KIND_LABELS[line.kind]}
                              </Badge>
                              {line.conceptName || "—"}
                              {line.isPartial && " (parcial)"}
                              {line.studentName && <span className="text-muted-foreground"> · {line.studentName}</span>}
                              {line.gradeLabel && <span className="text-muted-foreground"> · {line.gradeLabel}</span>}
                              {line.discountVes > 0 && (
                                <span className="text-emerald-700 dark:text-emerald-400" title={line.discountReason}>
                                  {" "}· desc. −{fmt(line.discountVes)}
                                </span>
                              )}
                              {line.exoneratedVes > 0 && (
                                <span className="text-purple-700 dark:text-purple-400" title={line.exonerationReason}>
                                  {" "}· exonerado {fmt(line.exoneratedVes)}
                                </span>
                              )}
                            </span>
                            <span className="whitespace-nowrap font-medium">
                              {fmt(line.amountVes)} VES
                              {line.conceptCurrency !== "VES" && line.originalAmount != null && (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  ({fmt(line.originalAmount)} {line.conceptCurrency})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold">Formas de pago</p>
                        <p className="text-xs">{row.methodsLabel || "—"}</p>
                        {row.banks && <p className="text-xs text-muted-foreground">Banco: {row.banks}</p>}
                        {row.references && <p className="text-xs text-muted-foreground">Referencia: {row.references}</p>}
                        {row.paymentCurrencies && <p className="text-xs text-muted-foreground">Moneda: {row.paymentCurrencies}</p>}
                        {row.holderDocument && <p className="mt-2 text-xs text-muted-foreground">Facturado a: {row.holderName} · {row.holderDocument}</p>}
                        {row.observations && <p className="mt-2 text-xs text-muted-foreground">Obs.: {row.observations}</p>}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
