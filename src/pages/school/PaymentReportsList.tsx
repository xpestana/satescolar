import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Eye, Loader2, Receipt } from "lucide-react";
import { ReceiptViewerModal } from "@/components/payments/ReceiptViewerModal";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";

export default function PaymentReportsList() {
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [viewing, setViewing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<any>(null);

  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years")
        .select("id").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["payment-reports-school", schoolId, tab],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_reports")
        .select(`
          *,
          students(id, document_id, form_data, family_id),
          families(id, father_last_name, mother_last_name),
          school_payment_methods(id, label, config)
        `)
        .eq("school_id", schoolId!)
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Get reporter (representative) info
  const reporterIds = useMemo(() => Array.from(new Set(reports.map((r: any) => r.reported_by).filter(Boolean))), [reports]);

  const { data: reporters = [] } = useQuery({
    queryKey: ["reports-reporters", reporterIds],
    queryFn: async () => {
      if (!reporterIds.length || !schoolId) return [];
      const { data } = await supabase.rpc("resolve_user_display_names", {
        _user_ids: reporterIds, _school_id: schoolId,
      });
      return (data as any[]) || [];
    },
    enabled: reporterIds.length > 0 && !!schoolId,
  });

  const reporterMap = new Map(reporters.map((r: any) => [r.user_id, r.display_name]));

  const studentName = (s: any) => {
    const fd = (s?.form_data as any) || {};
    return [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || s?.document_id || "Estudiante";
  };

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("payment_reports")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-reports-school"] });
      qc.invalidateQueries({ queryKey: ["payment-reports-pending-count"] });
      toast({ title: "Reporte rechazado" });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Build initial payload for PaymentFormModal from report
  const handleConfirm = async (r: any) => {
    // Need enrollment for the modal
    const { data: enr } = await supabase.from("enrollments")
      .select("*, sections(id, name, grade_level)")
      .eq("student_id", r.student_id)
      .eq("school_year_id", r.school_year_id)
      .eq("school_id", schoolId!)
      .maybeSingle();
    setConfirmTarget({ report: r, enrollment: enr });
  };

  const handleConfirmCompleted = async (paymentId: string) => {
    if (!confirmTarget) return;
    await supabase.from("payment_reports").update({
      status: "confirmed",
      confirmed_payment_id: paymentId,
      confirmed_at: new Date().toISOString(),
    }).eq("id", confirmTarget.report.id);
    qc.invalidateQueries({ queryKey: ["payment-reports-school"] });
    qc.invalidateQueries({ queryKey: ["payment-reports-pending-count"] });
    setConfirmTarget(null);
  };

  return (
    <DashboardLayout>
      <PageHeader title="Reportes de pagos" breadcrumbs={[{ label: "Pagos" }, { label: "Reportes" }]} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmados</TabsTrigger>
          <TabsTrigger value="rejected">Rechazados</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>
          ) : reports.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sin reportes en este estado</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {reports.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Estudiante</p>
                          <p className="font-medium">{studentName(r.students)}</p>
                          <p className="text-xs text-muted-foreground">{r.students?.document_id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Reportado por</p>
                          <p className="font-medium">{reporterMap.get(r.reported_by) || "—"}</p>
                          <p className="text-xs text-muted-foreground">Familia {r.families?.father_last_name} {r.families?.mother_last_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cuota</p>
                          <p className="font-medium">{r.concept_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Monto</p>
                          <p className="font-medium">{Number(r.amount_reported).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {r.currency_reported}</p>
                          <p className="text-xs text-muted-foreground">{new Date(r.payment_date).toLocaleDateString("es-VE")}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Enviado a (colegio)</p>
                          <p className="text-sm">{r.school_method_label || r.school_payment_methods?.label || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Método utilizado</p>
                          <p className="text-sm capitalize">{(r.payer_method || "").replace("_", " ")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Banco origen</p>
                          <p className="text-sm">{r.payer_bank_name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Referencia</p>
                          <p className="text-sm font-mono">{r.reference_code || "—"}</p>
                        </div>

                        {(r.payer_phone || r.payer_document) && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Titular</p>
                            <p className="text-sm">{r.payer_document} {r.payer_phone ? `· ${r.payer_phone}` : ""}</p>
                          </div>
                        )}
                        {(r.payer_account_email || r.payer_account_holder) && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Zelle</p>
                            <p className="text-sm">{r.payer_account_holder} · {r.payer_account_email}</p>
                          </div>
                        )}
                        {r.notes && (
                          <div className="col-span-full">
                            <p className="text-xs text-muted-foreground">Notas</p>
                            <p className="text-sm italic">{r.notes}</p>
                          </div>
                        )}
                        {r.rejection_reason && (
                          <div className="col-span-full">
                            <p className="text-xs text-muted-foreground">Motivo de rechazo</p>
                            <p className="text-sm text-destructive">{r.rejection_reason}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 md:w-48">
                        <Button variant="outline" size="sm" onClick={() => setViewing(r.receipt_url)}>
                          <Eye className="h-4 w-4 mr-1" />Ver capture
                        </Button>
                        {tab === "pending" && (
                          <>
                            <Button size="sm" onClick={() => handleConfirm(r)}>
                              <CheckCircle2 className="h-4 w-4 mr-1" />Confirmar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setRejectTarget(r)}>
                              <XCircle className="h-4 w-4 mr-1" />Rechazar
                            </Button>
                          </>
                        )}
                        {tab !== "pending" && (
                          <Badge className="self-center" variant={tab === "confirmed" ? "default" : "destructive"}>
                            {tab === "confirmed" ? "Confirmado" : "Rechazado"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ReceiptViewerModal open={!!viewing} onOpenChange={(v) => !v && setViewing(null)} receiptUrl={viewing} />

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar reporte</DialogTitle>
            <DialogDescription>Escribe el motivo. El representante lo verá en su historial.</DialogDescription>
          </DialogHeader>
          <Label className="text-xs">Motivo *</Label>
          <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ej: La referencia no corresponde, capture ilegible..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancelar</Button>
            <Button variant="destructive"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => reject.mutate({ id: rejectTarget.id, reason: rejectReason })}>
              {reject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm via PaymentFormModal preloaded from report */}
      {confirmTarget && (
        <PaymentFormModal
          open={!!confirmTarget}
          onOpenChange={(v) => { if (!v) setConfirmTarget(null); }}
          student={confirmTarget.report.students}
          enrollment={confirmTarget.enrollment}
          schoolId={schoolId!}
          schoolYearId={confirmTarget.report.school_year_id}
          fromReport={confirmTarget.report}
          onSaved={handleConfirmCompleted}
        />
      )}
    </DashboardLayout>
  );
}
