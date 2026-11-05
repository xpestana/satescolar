import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CreditCard } from "lucide-react";
import { usePayrollAriRates } from "@/hooks/payroll/usePayrollAriRates";
import { usePayrollDefaultMethods } from "@/hooks/payroll/usePayrollDefaultMethods";
import { usePayrollPayments, type PayrollPaymentRow } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { usePayrollContributionConfig } from "@/hooks/payroll/usePayrollContributionConfig";
import { MethodDetails, CopyableField } from "@/components/payroll/MethodDetails";
import { PayrollPaymentActions } from "@/components/payroll/PayrollPaymentActions";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { staffGuide } from "@/components/payroll/payrollGuides";
import { PayrollPaymentFormModal } from "@/components/payroll/PayrollPaymentFormModal";
import { todayCaracasIso } from "@/lib/dateUtils";
import { CATEGORY_LABELS, STATUS_LABELS, type PayrollBeneficiary, type PayrollCategory, type PayrollPaymentStatus } from "@/lib/payroll/types";
import { missingBeneficiaryData } from "@/lib/payroll/withholdings/beneficiaryRules";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";

interface PayrollStaffTabProps {
  schoolId: string;
  periodId: string;
  beneficiaries: PayrollBeneficiary[];
  canRegister: boolean;
  canApprove: boolean;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const statusVariant = (s: PayrollPaymentStatus) =>
  s === "paid" ? "default" : s === "voided" ? "destructive" : s === "approved" ? "secondary" : "outline";

/** People paid through payroll: one line per person and per period. */
export function PayrollStaffTab({ schoolId, periodId, beneficiaries, canRegister, canApprove }: PayrollStaffTabProps) {
  const { payments } = usePayrollPayments(schoolId, { periodId });
  const { data: defaultMethods = {} } = usePayrollDefaultMethods(schoolId);
  const { vatEnabled, islrEnabled } = usePayrollTaxConfig(schoolId);
  const { enabled: contributionsEnabled } = usePayrollContributionConfig(schoolId);
  const { ratesByBeneficiary } = usePayrollAriRates(schoolId);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [registerFor, setRegisterFor] = useState<PayrollBeneficiary | null>(null);

  const paymentByBeneficiary = useMemo(() => {
    const map: Record<string, PayrollPaymentRow> = {};
    for (const p of payments) {
      if (p.payment_kind !== "payroll") continue;
      // Keep the non-voided one if present, else the latest.
      if (!map[p.beneficiary_id] || p.status !== "voided") map[p.beneficiary_id] = p;
    }
    return map;
  }, [payments]);

  const filtered = useMemo(() => {
    let rows = beneficiaries.filter((b) => b.is_active && b.payment_regime === "payroll");
    if (categoryFilter !== "all") rows = rows.filter((b) => b.category === categoryFilter);
    if (search.trim()) {
      const q = normalize(search);
      rows = rows.filter((b) => normalize(b.full_name).includes(q) || normalize(b.document_id ?? "").includes(q));
    }
    return rows;
  }, [beneficiaries, categoryFilter, search]);

  const today = todayCaracasIso();
  const missingFor = (b: PayrollBeneficiary) =>
    vatEnabled || islrEnabled
      ? missingBeneficiaryData(b, {
          vatEnabled,
          islrEnabled,
          hasAriRate: !!resolveRateVersion(ratesByBeneficiary[b.id] ?? [], today),
        })
      : [];

  const staffCategories = (Object.keys(CATEGORY_LABELS) as PayrollCategory[]).filter((c) => c !== "supplier");

  return (
    <>
      <PayrollGuide guide={staffGuide({ vatEnabled, islrEnabled, contributionsEnabled })} />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {staffCategories.map((c) => (
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
                <TableHead className="w-64">Método principal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Neto (VES)</TableHead>
                <TableHead className="w-64">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay beneficiarios.</TableCell></TableRow>
              ) : (
                filtered.map((b) => {
                  const payment = paymentByBeneficiary[b.id];
                  const isLive = !!payment && payment.status !== "voided";
                  const missing = isLive ? [] : missingFor(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.full_name}
                        <div className="text-xs text-muted-foreground">{b.document_id || "—"}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{CATEGORY_LABELS[b.category]}</Badge></TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          {defaultMethods[b.id] ? (
                            <MethodDetails method={defaultMethods[b.id]} showType />
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin método</span>
                          )}
                          {b.document_id && <CopyableField label="Cédula" value={b.document_id} />}
                          {b.phone && <CopyableField label="Teléfono" value={b.phone} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isLive ? (
                          <>
                            <Badge variant={statusVariant(payment.status)}>{STATUS_LABELS[payment.status]}</Badge>
                            {payment.status === "paid" && payment.payment_reference && (
                            <div className="text-xs text-muted-foreground">Ref. {payment.payment_reference}</div>
                          )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin registrar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isLive ? payment.net_amount_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 }) : "—"}
                      </TableCell>
                      <TableCell>
                        {isLive ? (
                          <PayrollPaymentActions schoolId={schoolId} payment={payment} canApprove={canApprove} />
                        ) : (
                          <div className="space-y-1">
                            <Button size="sm" variant="outline" disabled={!canRegister || missing.length > 0} onClick={() => setRegisterFor(b)}>
                              <CreditCard className="h-3 w-3 mr-1" />Registrar
                            </Button>
                            {missing.length > 0 && (
                              <p className="text-xs text-destructive">Complete en Beneficiarios: {missing.join(", ")}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {registerFor && (
        <PayrollPaymentFormModal
          open={!!registerFor}
          onOpenChange={(v) => !v && setRegisterFor(null)}
          schoolId={schoolId}
          periodId={periodId}
          beneficiary={{ id: registerFor.id, full_name: registerFor.full_name }}
        />
      )}
    </>
  );
}
