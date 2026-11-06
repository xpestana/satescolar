import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Users, CreditCard, FileSpreadsheet, Settings, Wallet, Loader2, Sheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSchoolFiscalData } from "@/hooks/payroll/useSchoolFiscalData";
import { fetchPayrollSheetPayments } from "@/hooks/payroll/fetchPayrollSheet";
import { buildPayrollSheetRows, exportPayrollSheet } from "@/lib/payroll/payrollSheet";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { usePayrollPeriods } from "@/hooks/payroll/usePayrollPeriods";
import { usePayrollBeneficiaries } from "@/hooks/payroll/usePayrollBeneficiaries";
import { usePayrollPayments } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { overviewGuide } from "@/components/payroll/payrollGuides";
import { exportPayrollExcel, type PayrollExcelRow } from "@/lib/payroll/payrollExcel";
import { CATEGORY_LABELS, METHOD_LABELS, type PayrollCategory } from "@/lib/payroll/types";

export default function PayrollDashboard() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { school } = useSchoolData();
  const { periods } = usePayrollPeriods(schoolId);
  const { beneficiaries } = usePayrollBeneficiaries(schoolId);
  const { vatEnabled, islrEnabled } = usePayrollTaxConfig(schoolId);
  const { data: fiscal } = useSchoolFiscalData(schoolId);
  const { toast } = useToast();
  const [sheetLoading, setSheetLoading] = useState(false);

  const [periodId, setPeriodId] = useState<string>("all");
  const { payments } = usePayrollPayments(schoolId, periodId !== "all" ? { periodId } : {});

  const stats = useMemo(() => {
    const live = payments.filter((p) => p.status !== "voided");
    const paid = live.filter((p) => p.status === "paid");
    const totalPaidVes = paid.reduce((s, p) => s + (p.net_amount_ves || 0), 0);
    const pendingCount = live.filter((p) => p.status !== "paid").length;

    const byCategory: Record<string, number> = {};
    for (const p of paid) {
      const cat = p.payroll_beneficiaries?.category ?? "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + (p.net_amount_ves || 0);
    }
    return { totalPaidVes, paidCount: paid.length, pendingCount, byCategory };
  }, [payments]);

  const handleExport = () => {
    const rows: PayrollExcelRow[] = payments.map((p) => ({
      beneficiaryName: p.payroll_beneficiaries?.full_name ?? "—",
      documentId: p.payroll_beneficiaries?.document_id ?? null,
      category: (p.payroll_beneficiaries?.category ?? "other") as PayrollCategory,
      periodName: p.payroll_periods?.name ?? "—",
      status: p.status,
      currency: p.currency,
      gross: p.gross_amount,
      deductions: p.deductions_amount,
      net: p.net_amount,
      netVes: p.net_amount_ves,
      methodLabel: p.payroll_payment_methods?.label ?? (p.payroll_payment_methods ? METHOD_LABELS[p.payroll_payment_methods.method_type] : null),
      paymentDate: p.payment_date,
      paymentReference: p.payment_reference,
    }));
    const periodName = periodId === "all" ? "todos" : periods.find((p) => p.id === periodId)?.name ?? "periodo";
    exportPayrollExcel(rows, `nomina-${(school?.name ?? "colegio")}-${periodName}`.replace(/\s+/g, "-"));
  };

  // The sheet the accountant receives: one row per worker of the selected period.
  const handleSheet = async () => {
    const period = periods.find((p) => p.id === periodId);
    if (!schoolId || !period) return;
    setSheetLoading(true);
    try {
      const rows = buildPayrollSheetRows(await fetchPayrollSheetPayments(schoolId, period.id));
      if (rows.length === 0) {
        toast({ title: "Este período no tiene pagos de personal" });
        return;
      }
      const schoolName = fiscal?.name ?? school?.name ?? "Colegio";
      exportPayrollSheet(
        { schoolName, schoolRif: fiscal?.rif ?? null, periodName: period.name, periodStart: period.start_date, periodEnd: period.end_date },
        rows,
        `planilla-${schoolName}-${period.name}`.replace(/\s+/g, "-")
      );
    } catch (e) {
      toast({ title: "No se pudo generar la planilla", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSheetLoading(false);
    }
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  const money = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2 });

  return (
    <DashboardLayout>
      <PageHeader
        title="Dashboard de Nómina"
        breadcrumbs={[{ label: "Nómina" }]}
        description="Indicadores de la nómina del colegio y exportación de los datos a Excel."
      />

      <PayrollGuide guide={overviewGuide({ vatEnabled, islrEnabled })} />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los períodos</SelectItem>
            {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" onClick={handleExport} disabled={payments.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-1" />Exportar Excel
        </Button>
        <Button
          variant="outline"
          onClick={handleSheet}
          disabled={periodId === "all" || sheetLoading}
          title={periodId === "all" ? "Elija un período" : "Una fila por trabajador, con parafiscales, ISLR y referencia"}
        >
          {sheetLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sheet className="h-4 w-4 mr-1" />}Planilla de nómina
        </Button>
        <Button asChild variant="outline"><Link to="/pagos/nomina/beneficiarios"><Users className="h-4 w-4 mr-1" />Beneficiarios</Link></Button>
        <Button asChild><Link to="/pagos/nomina/registro"><CreditCard className="h-4 w-4 mr-1" />Registrar</Link></Button>
        <Button asChild variant="ghost"><Link to="/pagos/nomina/configuracion"><Settings className="h-4 w-4 mr-1" />Configuración</Link></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total pagado (VES)" value={money(stats.totalPaidVes)} />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Pagos realizados" value={String(stats.paidCount)} />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Pendientes (borrador/aprobado)" value={String(stats.pendingCount)} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Beneficiarios activos" value={String(beneficiaries.filter((b) => b.is_active).length)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Total pagado por categoría (VES)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(CATEGORY_LABELS) as PayrollCategory[]).map((c) => (
              <div key={c} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[c]}</p>
                <p className="text-lg font-semibold">{money(stats.byCategory[c] ?? 0)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 text-primary p-2.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
