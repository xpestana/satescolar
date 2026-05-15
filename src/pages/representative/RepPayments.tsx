import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Receipt, CheckCircle2, XCircle, Clock, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { PaymentReportModal } from "@/components/payments/PaymentReportModal";

export default function RepPayments() {
  const { familyId, schoolId } = useRepresentativeFamily();
  const [reportTarget, setReportTarget] = useState<{ student: any; balance: any } | null>(null);

  const { data: schoolYear } = useQuery({
    queryKey: ["active-school-year-rep", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years")
        .select("id, year_range")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["family-students-payments", familyId],
    queryFn: async () => {
      const { data } = await supabase.from("students")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at");
      return data || [];
    },
    enabled: !!familyId,
  });

  const studentIds = students.map((s) => s.id);

  // Misma lógica de morosidad que el colegio (RPC alineado con get_delinquent_students).
  const { data: balances = [] } = useQuery({
    queryKey: ["family-delinquent-balances-rep", familyId, schoolId, schoolYear?.id],
    queryFn: async () => {
      if (!familyId || !schoolId || !schoolYear?.id) return [];
      const { data, error } = await supabase.rpc("get_delinquent_balances_for_family", {
        _family_id: familyId,
        _school_id: schoolId,
        _school_year_id: schoolYear.id,
      });
      if (error) throw error;
      const rows = (data || []) as { balance_json: Record<string, unknown> }[];
      return rows.map((r) => r.balance_json).filter(Boolean) as any[];
    },
    enabled: !!familyId && !!schoolId && !!schoolYear?.id && studentIds.length > 0,
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["school-payment-methods-rep", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["payment-reports-family", familyId],
    queryFn: async () => {
      const { data } = await supabase.from("payment_reports")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!familyId,
  });

  const studentName = (s: any) => {
    const fd = (s?.form_data as any) || {};
    return [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ") || "Estudiante";
  };

  const studentMap = new Map(students.map((s) => [s.id, s]));

  const delinquentCount = balances.length;

  return (
    <DashboardLayout>
      <PageHeader title="Mis pagos" breadcrumbs={[{ label: "Pagos" }]} />

      {delinquentCount > 0 && (
        <Alert className="border-orange-300 bg-orange-50 mb-4">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-700">
            Tienes <strong>{delinquentCount}</strong> cuota(s) <strong>vencida(s)</strong> según el calendario del colegio. Puedes reportar el pago desde la tabla.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList>
          <TabsTrigger value="pendientes">Cuotas vencidas</TabsTrigger>
          <TabsTrigger value="metodos">Métodos de pago del colegio</TabsTrigger>
          <TabsTrigger value="historial">Mis reportes ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="space-y-4 mt-4">
          {balances.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No hay cuotas vencidas (morosidad) en este momento. Las cuotas por vencer no se muestran aquí.</CardContent></Card>
          ) : (
            students.map((s) => {
              const stBalances = balances.filter((b) => b.student_id === s.id);
              if (stBalances.length === 0) return null;
              return (
                <Card key={s.id}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">{studentName(s)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Concepto</TableHead>
                          <TableHead>Saldo vencido</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-32">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stBalances.map((b: any) => (
                            <TableRow key={b.id}>
                              <TableCell className="font-medium">
                                {b.payment_plan_concepts?.payment_concepts?.name || "Concepto"}
                                {b.currency !== "VES" && (
                                  <span className="ml-2 text-xs text-muted-foreground">({b.currency})</span>
                                )}
                              </TableCell>
                              <TableCell>{Number(b.balance).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {b.currency}</TableCell>
                              <TableCell>
                                <Badge className="bg-orange-500 hover:bg-orange-600">Vencida</Badge>
                              </TableCell>
                              <TableCell>
                                <Button size="sm" onClick={() => setReportTarget({ student: s, balance: b })}>
                                  <Receipt className="h-3 w-3 mr-1" />Reportar pago
                                </Button>
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="metodos" className="space-y-3 mt-4">
          {methods.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">El colegio no ha publicado métodos de pago</CardContent></Card>
          ) : methods.map((m: any) => {
            const cfg = m.config || {};
            return (
              <Card key={m.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{m.label}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                        {cfg.bank_name && <p>Banco: {cfg.bank_name}</p>}
                        {cfg.account_number && <p>Cuenta: {cfg.account_number}</p>}
                        {cfg.account_holder && <p>Titular: {cfg.account_holder}</p>}
                        {cfg.document_id && <p>Cédula/RIF: {cfg.document_id}</p>}
                        {cfg.phone && <p>Teléfono: {cfg.phone}</p>}
                        {cfg.email && <p>Correo: {cfg.email}</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="historial" className="space-y-3 mt-4">
          {reports.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No has reportado pagos aún</CardContent></Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.payment_date).toLocaleDateString("es-VE")}</TableCell>
                    <TableCell>{studentName(studentMap.get(r.student_id))}</TableCell>
                    <TableCell>{r.concept_name}</TableCell>
                    <TableCell>{Number(r.amount_reported).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {r.currency_reported}</TableCell>
                    <TableCell className="text-xs">{r.reference_code || "—"}</TableCell>
                    <TableCell>
                      {r.status === "pending" && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>}
                      {r.status === "confirmed" && <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmado</Badge>}
                      {r.status === "rejected" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rechazado</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {reportTarget && schoolYear && (
        <PaymentReportModal
          open={!!reportTarget}
          onOpenChange={(v) => !v && setReportTarget(null)}
          schoolId={schoolId!}
          schoolYearId={schoolYear.id}
          familyId={familyId!}
          studentId={reportTarget.student.id}
          studentName={studentName(reportTarget.student)}
          balance={reportTarget.balance}
        />
      )}
    </DashboardLayout>
  );
}
