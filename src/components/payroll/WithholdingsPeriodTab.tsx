import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { withholdingsPeriodGuide } from "@/components/payroll/payrollGuides";
import { usePayrollWithholdings } from "@/hooks/payroll/usePayrollWithholdings";
import { formatDateOnly, todayCaracasIso } from "@/lib/dateUtils";
import { formatMoney } from "@/lib/payroll/buildPayrollReceiptData";
import { buildWithholdingVoucherData, type WithholdingRow } from "@/lib/payroll/withholdings/buildWithholdingVoucherData";
import { fiscalPeriodOf, listFiscalPeriods } from "@/lib/payroll/withholdings/fiscalPeriod";
import { generateWithholdingVoucherPdf } from "@/lib/payroll/withholdings/generateWithholdingPdf";
import { TAX_TYPE_LABELS, WITHHOLDING_STATUS_LABELS, type TaxType, type WithholdingStatus } from "@/lib/payroll/withholdings/types";
import { exportWithholdingsExcel, totalWithheld } from "@/lib/payroll/withholdings/withholdingsExcel";

const statusVariant = (s: WithholdingStatus) =>
  s === "remitted" ? "default" : s === "voided" ? "destructive" : s === "declared" ? "secondary" : "outline";

interface WithholdingsPeriodTabProps {
  schoolId: string;
  taxType: TaxType;
}

/** Withholdings of a fortnight (IVA) or month (ISLR): vouchers, export, declared and remitted. */
export function WithholdingsPeriodTab({ schoolId, taxType }: WithholdingsPeriodTabProps) {
  const { toast } = useToast();
  const today = todayCaracasIso();
  const periods = useMemo(() => listFiscalPeriods(taxType, `${Number(today.slice(0, 4)) - 1}-01-01`, today), [taxType, today]);
  const [periodStart, setPeriodStart] = useState(fiscalPeriodOf(taxType, today).start);
  const period = periods.find((p) => p.start === periodStart);

  const { rows, isLoading, setStatus, sendVoucher } = usePayrollWithholdings(schoolId, { taxType, periodStart });
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"declared" | "remitted" | null>(null);
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");

  const total = totalWithheld(rows);
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  const canSelect = (r: WithholdingRow) => r.withheld_ves > 0 && (r.status === "issued" || r.status === "declared");
  const selectedRows = rows.filter((r) => selected.includes(r.id));
  const canDeclare = selectedRows.length > 0 && selectedRows.every((r) => r.status === "issued");
  const canRemit = selectedRows.length > 0 && selectedRows.every((r) => r.status === "declared");

  const downloadVoucher = (row: WithholdingRow) => {
    generateWithholdingVoucherPdf(buildWithholdingVoucherData(row)).save(`comprobante-${row.voucher_number ?? row.id}.pdf`);
  };

  const confirmStatus = () => {
    if (!dialog) return;
    setStatus.mutate(
      { ids: selected, status: dialog, date, reference: reference.trim() },
      {
        onSuccess: (count) => {
          toast({ title: `${count} retención(es) marcada(s) como ${dialog === "declared" ? "declaradas" : "enteradas"}` });
          setDialog(null);
          setSelected([]);
          setReference("");
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const money = (value: number) => formatMoney(value, "VES");

  return (
    <div className="space-y-4">
      <PayrollGuide guide={withholdingsPeriodGuide(taxType)} className="mb-0" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{taxType === "vat" ? "Quincena" : "Mes"}</Label>
          <Select value={periodStart} onValueChange={(v) => { setPeriodStart(v); setSelected([]); }}>
            <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.start} value={p.start}>{formatDateOnly(p.start)} al {formatDateOnly(p.end)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border px-4 py-2">
          <p className="text-xs text-muted-foreground">Total a enterar ({TAX_TYPE_LABELS[taxType]})</p>
          <p className="text-lg font-semibold">{money(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button variant="outline" disabled={rows.length === 0} onClick={() => exportWithholdingsExcel(taxType, rows, periodStart)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel de la declaración
          </Button>
          <Button variant="outline" disabled={!canDeclare} onClick={() => setDialog("declared")}>Marcar declaradas</Button>
          <Button variant="outline" disabled={!canRemit} onClick={() => setDialog("remitted")}>Marcar enteradas</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        El Excel es provisional: reúne los datos para declarar hasta tener el formato exacto del portal del SENIAT.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Retenido a</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">{taxType === "vat" ? "IVA causado" : "Monto sujeto"}</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay retenciones en este período.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={r.status === "voided" ? "opacity-60" : ""}>
                    <TableCell>
                      {canSelect(r) && (
                        <Checkbox aria-label="Seleccionar retención" checked={selected.includes(r.id)} onCheckedChange={(v) => toggle(r.id, !!v)} />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.voucher_number ?? "—"}</TableCell>
                    <TableCell>
                      {r.beneficiary_snapshot.name ?? "—"}
                      <div className="text-xs text-muted-foreground">{r.beneficiary_snapshot.tax_id ?? r.beneficiary_snapshot.document_id ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.payroll_purchase_documents?.document_number ?? (r.source === "salary" ? "Nómina" : "—")}
                      {r.islr_concept_name && <div className="text-xs text-muted-foreground">{r.islr_concept_name}</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(r.tax_type === "vat" ? r.tax_amount_ves : r.base_ves)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.rate_pct} %
                      {r.is_override && <div className="text-xs text-amber-600" title={r.override_reason ?? ""}>Excepción</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {money(r.withheld_ves)}
                      {r.no_withholding_reason && <div className="text-xs font-normal text-muted-foreground">{r.no_withholding_reason}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{WITHHOLDING_STATUS_LABELS[r.status]}</Badge>
                      {r.status === "remitted" && r.remittance_ref && <div className="text-xs text-muted-foreground">{r.remittance_ref}</div>}
                    </TableCell>
                    <TableCell>
                      {r.voucher_number && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Descargar comprobante" onClick={() => downloadVoucher(r)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title={r.delivered_at ? `Enviado el ${formatDateOnly(r.delivered_at.slice(0, 10))}` : "Enviar por correo"}
                            disabled={r.status === "voided" || sendVoucher.isPending}
                            onClick={() =>
                              sendVoucher.mutate(r.id, {
                                onSuccess: () => toast({ title: "Comprobante enviado" }),
                                onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                              })
                            }
                          >
                            <Mail className={r.delivered_at ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5"} />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "declared" ? "Marcar como declaradas" : "Marcar como enteradas"}</DialogTitle>
            <DialogDescription>
              {selected.length} retención(es){period ? ` del ${formatDateOnly(period.start)} al ${formatDateOnly(period.end)}` : ""}.
              {dialog === "declared" && " Una retención declarada ya no se puede anular."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{dialog === "declared" ? "N° de declaración" : "Referencia del pago"}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={confirmStatus} disabled={!date || setStatus.isPending}>
              {setStatus.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
