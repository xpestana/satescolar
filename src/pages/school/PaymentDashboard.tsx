import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, TrendingUp, AlertTriangle, Users, CreditCard } from "lucide-react";

export default function PaymentDashboard() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();

  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Recent payments
  const { data: recentPayments = [], isLoading } = useQuery({
    queryKey: ["recent-payments", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("payments")
        .select("*, students(form_data, document_id), payment_method_entries(method, currency, amount_ves)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(15);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // All balances for stats
  const { data: allBalances = [] } = useQuery({
    queryKey: ["all-balances-dashboard", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("student_id, balance, paid_amount, total_amount, status")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const todayPayments = recentPayments.filter((p: any) => p.payment_date === today);
  const totalToday = todayPayments.reduce((s: number, p: any) => s + (p.total_amount_ves || 0), 0);
  const totalMonth = recentPayments.filter((p: any) => p.payment_date >= monthStart).reduce((s: number, p: any) => s + (p.total_amount_ves || 0), 0);
  const totalDebt = allBalances.reduce((s: number, b: any) => s + (b.balance || 0), 0);
  const totalCollected = allBalances.reduce((s: number, b: any) => s + (b.paid_amount || 0), 0);
  const delinquentStudents = new Set(allBalances.filter((b: any) => b.balance > 0).map((b: any) => b.student_id)).size;

  // Today methods breakdown
  const todayByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    todayPayments.forEach((p: any) => {
      (p.payment_method_entries || []).forEach((m: any) => {
        map[m.method] = (map[m.method] || 0) + (m.amount_ves || 0);
      });
    });
    return Object.entries(map);
  }, [todayPayments]);

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Dashboard de Pagos" breadcrumbs={[{ label: "Administrativo" }, { label: "Dashboard de Pagos" }]} />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Hoy</p><p className="text-lg font-bold">{totalToday.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Este mes</p><p className="text-lg font-bold">{totalMonth.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><CreditCard className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total recaudado</p><p className="text-lg font-bold">{totalCollected.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Deuda total</p><p className="text-lg font-bold text-destructive">{totalDebt.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-yellow-600" /></div>
            <div><p className="text-xs text-muted-foreground">Morosos</p><p className="text-lg font-bold">{delinquentStudents}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today by method */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Resumen del Día por Método</CardTitle></CardHeader>
          <CardContent>
            {todayByMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay pagos registrados hoy</p>
            ) : (
              <div className="space-y-2">
                {todayByMethod.map(([method, amount]) => (
                  <div key={method} className="flex justify-between items-center">
                    <Badge variant="outline" className="capitalize">{method.replace("_", " ")}</Badge>
                    <span className="font-mono font-medium">{amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent payments */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Últimos Pagos</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Estudiante</TableHead><TableHead>Monto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recentPayments.slice(0, 10).map((p: any) => {
                    const fd = p.students?.form_data as any;
                    const name = [fd?.primer_nombre, fd?.primer_apellido].filter(Boolean).join(" ");
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{new Date(p.payment_date).toLocaleDateString("es-VE")}</TableCell>
                        <TableCell className="text-sm">{name}</TableCell>
                        <TableCell className="font-medium text-sm">{p.total_amount_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
