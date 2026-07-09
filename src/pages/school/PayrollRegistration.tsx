import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Search, CreditCard, CheckCircle2, DollarSign, Ban, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSchoolId } from "@/hooks/useSchoolId";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { ExchangeRateWidget } from "@/components/payments/ExchangeRateWidget";
import { usePayrollBeneficiaries } from "@/hooks/payroll/usePayrollBeneficiaries";
import { usePayrollPeriods } from "@/hooks/payroll/usePayrollPeriods";
import { usePayrollPayments, type PayrollPaymentRow } from "@/hooks/payroll/usePayrollPayments";
import { PayrollPaymentFormModal } from "@/components/payroll/PayrollPaymentFormModal";
import { CATEGORY_LABELS, STATUS_LABELS, type PayrollBeneficiary, type PayrollCategory, type PayrollPaymentStatus } from "@/lib/payroll/types";

export default function PayrollRegistration() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { has } = usePermissions();
  const { toast } = useToast();

  const canRegister = has("payroll.register");
  const canApprove = has("payroll.approve");

  const { periods, isLoading: periodsLoading } = usePayrollPeriods(schoolId);
  const { beneficiaries } = usePayrollBeneficiaries(schoolId);

  const [periodId, setPeriodId] = useState<string>("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const activePeriodId = periodId || periods[0]?.id || "";

  const { payments, approvePayment, markPaid, voidPayment } = usePayrollPayments(schoolId, { periodId: activePeriodId });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [registerFor, setRegisterFor] = useState<PayrollBeneficiary | null>(null);
  const [voidFor, setVoidFor] = useState<PayrollPaymentRow | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const paymentByBeneficiary = useMemo(() => {
    const map: Record<string, PayrollPaymentRow> = {};
    for (const p of payments) {
      // Keep the non-voided one if present, else the latest.
      if (!map[p.beneficiary_id] || p.status !== "voided") map[p.beneficiary_id] = p;
    }
    return map;
  }, [payments]);

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    let rows = beneficiaries.filter((b) => b.is_active);
    if (categoryFilter !== "all") rows = rows.filter((b) => b.category === categoryFilter);
    if (search.trim()) {
      const q = normalize(search);
      rows = rows.filter((b) => normalize(b.full_name).includes(q) || normalize(b.document_id ?? "").includes(q));
    }
    return rows;
  }, [beneficiaries, categoryFilter, search]);

  const badgeVariant = (s: PayrollPaymentStatus) =>
    s === "paid" ? "default" : s === "voided" ? "destructive" : s === "approved" ? "secondary" : "outline";

  const handlePay = (payment: PayrollPaymentRow) => {
    markPaid.mutate(
      { paymentId: payment.id },
      {
        onSuccess: ({ emailSent }) =>
          toast({
            title: "Pago marcado como pagado",
            description: emailSent ? "Se envió el recibo por correo." : "No se pudo enviar el recibo por correo.",
          }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const confirmVoid = () => {
    if (!voidFor) return;
    voidPayment.mutate(
      { paymentId: voidFor.id, reason: voidReason.trim() || "Sin motivo" },
      {
        onSuccess: () => { toast({ title: "Pago anulado" }); setVoidFor(null); setVoidReason(""); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  const activePeriod = periods.find((p) => p.id === activePeriodId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Registro de Nómina"
        breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Nómina", href: "/pagos/nomina" }, { label: "Registro" }]}
        description="Selecciona el período y registra, aprueba y paga a cada beneficiario de la nómina."
      />

      {periodsLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cargando períodos...</CardContent></Card>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay períodos de nómina. Crea uno en{" "}
            <Link to="/pagos/nomina/configuracion" className="text-primary underline">Configuración de Nómina</Link>.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={periodOpen} className="w-[240px] justify-between font-normal">
                  <span className="truncate">
                    {activePeriod ? `${activePeriod.name}${activePeriod.status === "closed" ? " (cerrado)" : ""}` : "Período"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar período..." />
                  <CommandList>
                    <CommandEmpty>No se encontró ningún período.</CommandEmpty>
                    <CommandGroup>
                      {periods.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => { setPeriodId(p.id); setPeriodOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", activePeriodId === p.id ? "opacity-100" : "opacity-0")} />
                          {p.name} {p.status === "closed" ? "(cerrado)" : ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nombre o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as PayrollCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Neto (VES)</TableHead>
                    <TableHead className="w-64">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay beneficiarios.</TableCell></TableRow>
                  ) : (
                    filtered.map((b) => {
                      const payment = paymentByBeneficiary[b.id];
                      const status = payment?.status;
                      const isLive = payment && payment.status !== "voided";
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">
                            {b.full_name}
                            <div className="text-xs text-muted-foreground">{b.document_id || "—"}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{CATEGORY_LABELS[b.category]}</Badge></TableCell>
                          <TableCell>
                            {isLive ? <Badge variant={badgeVariant(status!)}>{STATUS_LABELS[status!]}</Badge> : <span className="text-xs text-muted-foreground">Sin registrar</span>}
                          </TableCell>
                          <TableCell>
                            {isLive ? payment!.net_amount_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 }) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {!isLive && (
                                <Button size="sm" variant="outline" disabled={!canRegister} onClick={() => setRegisterFor(b)}>
                                  <CreditCard className="h-3 w-3 mr-1" />Registrar
                                </Button>
                              )}
                              {isLive && status === "draft" && (
                                <Button size="sm" variant="secondary" disabled={!canApprove || approvePayment.isPending} onClick={() => approvePayment.mutate(payment!.id, { onSuccess: () => toast({ title: "Pago aprobado" }), onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }) })}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Aprobar
                                </Button>
                              )}
                              {isLive && status === "approved" && (
                                <Button size="sm" disabled={!canApprove || markPaid.isPending} onClick={() => handlePay(payment!)}>
                                  {markPaid.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />}Pagar
                                </Button>
                              )}
                              {isLive && status !== "paid" && (
                                <Button size="sm" variant="ghost" disabled={!canApprove} title="Anular" onClick={() => setVoidFor(payment!)}>
                                  <Ban className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <ExchangeRateWidget schoolId={schoolId} />
        </>
      )}

      {registerFor && activePeriod && (
        <PayrollPaymentFormModal
          open={!!registerFor}
          onOpenChange={(v) => !v && setRegisterFor(null)}
          schoolId={schoolId}
          periodId={activePeriod.id}
          beneficiary={{ id: registerFor.id, full_name: registerFor.full_name }}
        />
      )}

      <Dialog open={!!voidFor} onOpenChange={(v) => { if (!v) { setVoidFor(null); setVoidReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Anular pago</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo de la anulación</Label>
            <Textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Indique por qué se anula este pago" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidFor(null); setVoidReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmVoid} disabled={voidPayment.isPending}>
              {voidPayment.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
