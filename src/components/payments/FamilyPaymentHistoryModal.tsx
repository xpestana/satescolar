import { useState, Fragment, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, History, Trash2, Pencil, ChevronDown, ChevronRight, AlertTriangle, Users, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDateOnly } from "@/lib/dateUtils";
import { getPaymentCoverage } from "@/lib/paymentStatus";
import { useFamilyCredits } from "@/hooks/payments/useFamilyCredits";
import { EditPaymentModal } from "@/components/payments/EditPaymentModal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  familyId: string;
  familyName: string;
  studentIds: string[];
  studentNames: Record<string, string>;
  schoolId: string;
  schoolYearId: string;
}

export function FamilyPaymentHistoryModal({ open, onOpenChange, familyId, familyName, studentIds, studentNames, schoolId, schoolYearId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);

  // Incluye pagos familiares (family_id) y pagos individuales históricos de los hijos
  const orFilter = useMemo(() => {
    const parts = [`family_id.eq.${familyId}`];
    if (studentIds.length > 0) parts.push(`student_id.in.(${studentIds.join(",")})`);
    return parts.join(",");
  }, [familyId, studentIds]);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["family-payment-history", familyId, schoolYearId],
    queryFn: async () => {
      const { data, error } = (await supabase.from("payments")
        .select(`
          *,
          payment_items!payment_items_payment_id_fkey(id, plan_concept_id, student_id, amount_ves, is_partial, payment_plan_concepts(payment_concepts(name))),
          payment_method_entries!payment_method_entries_payment_id_fkey(id, method, currency, amount_original, exchange_rate, amount_ves, reference_code, bank_name, payment_date)
        `)
        .or(orFilter)
        .eq("school_year_id", schoolYearId)
        .eq("school_id", schoolId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })) as any;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open && !!familyId,
  });

  const { data: schoolMethods = [] } = useQuery({
    queryKey: ["school-payment-methods-history", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods").select("id, label").eq("school_id", schoolId);
      return data || [];
    },
    enabled: open && !!schoolId,
  });
  const methodLabel = (raw: string) => {
    const found = schoolMethods.find((sm: any) => sm.id === raw);
    if (found) return found.label;
    if (!raw) return "—";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const deleteMut = useMutation({
    mutationFn: async (paymentId: string) => {
      const payment = payments.find((p: any) => p.id === paymentId);
      if (!payment) throw new Error("Pago no encontrado");

      // 1) Revertir saldos por hijo (item.student_id) con fallback al pago
      for (const item of payment.payment_items || []) {
        const balanceStudentId = item.student_id ?? payment.student_id;
        if (!balanceStudentId) continue;
        const { data: bal } = await supabase.from("student_concept_balances")
          .select("*")
          .eq("student_id", balanceStudentId)
          .eq("school_year_id", schoolYearId)
          .eq("school_id", schoolId)
          .eq("plan_concept_id", item.plan_concept_id)
          .maybeSingle();
        if (!bal) continue;
        const newPaid = Math.max(0, (Number(bal.paid_amount) || 0) - (Number(item.amount_ves) || 0));
        const newBalance = Math.max(0, (Number(bal.total_amount) || 0) - newPaid);
        const newStatus = newPaid <= 0 ? "pending" : (newBalance <= 0 ? "paid" : "partial");
        await supabase.from("student_concept_balances").update({
          paid_amount: newPaid,
          balance: newBalance,
          status: newStatus,
        }).eq("id", bal.id);
      }

      // 2) Delete payment (cascades to items + method entries)
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-payment-history"] });
      qc.invalidateQueries({ queryKey: ["family-students-balances"] });
      qc.invalidateQueries({ queryKey: ["families-payment-registration"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      toast({ title: "Pago eliminado", description: "Los saldos de los estudiantes fueron restaurados." });
      setConfirmDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const totalGlobal = payments.reduce((s: number, p: any) => s + (Number(p.total_amount_ves) || 0), 0);

  const { entries: creditEntries, balance: creditBalance } = useFamilyCredits(open ? familyId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Pagos — Familia {familyName}
          </DialogTitle>
        </DialogHeader>

        {creditBalance > 0.01 && (
          <Badge variant="outline" className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 w-fit">
            <Tag className="h-3 w-3" />
            Saldo a favor disponible: {creditBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
          </Badge>
        )}

        {creditEntries.length > 0 && (
          <Card>
            <CardContent className="py-3">
              <p className="text-sm font-semibold mb-2">Movimientos de saldo a favor</p>
              <div className="space-y-1 text-xs">
                {creditEntries.map((c) => (
                  <div key={c.id} className="flex justify-between items-start border-b py-1 last:border-0">
                    <div>
                      <span className={c.entry_type === "credit" ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                        {c.entry_type === "credit" ? "+ Generado" : "− Aplicado"}
                      </span>
                      {" "}· {formatDateOnly(c.created_at)}
                      {c.note && <div className="text-muted-foreground">{c.note}</div>}
                    </div>
                    <span className="font-medium whitespace-nowrap ml-2">
                      {c.entry_type === "credit" ? "+" : "-"}{c.amount_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
        ) : payments.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No hay pagos registrados para esta familia.</CardContent></Card>
        ) : (
          <>
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-muted-foreground">{payments.length} pago(s) registrado(s)</span>
              <Badge variant="outline" className="text-base">Total: {totalGlobal.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Conceptos</TableHead>
                  <TableHead>Total VES</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any) => (
                  <Fragment key={p.id}>
                    <TableRow key={p.id}>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggle(p.id)}>
                          {expanded[p.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateOnly(p.payment_date)}</TableCell>
                      <TableCell className="text-xs">
                        {p.invoice_number && <div className="font-medium whitespace-nowrap">Fact. N° {p.invoice_number}</div>}
                        {p.control_number && <div className="font-medium whitespace-nowrap">Ctrl. N° {p.control_number}</div>}
                        {p.invoice_name || "—"}
                        {p.invoice_rif && <div className="text-muted-foreground">{p.invoice_rif}</div>}
                      </TableCell>
                      <TableCell>
                        {p.family_id ? (
                          <Badge variant="secondary" className="text-xs gap-1"><Users className="h-3 w-3" />Familiar</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{studentNames[p.student_id] || "Estudiante"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{(p.payment_items || []).length} concepto(s)</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{Number(p.total_amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {(() => {
                          const cov = getPaymentCoverage(p);
                          return <Badge variant="outline" className={cov.className}>{cov.label}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "completed" ? "default" : "secondary"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar pago" onClick={() => setEditPaymentId(p.id)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Eliminar pago" onClick={() => setConfirmDeleteId(p.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded[p.id] && (
                      <TableRow key={p.id + "-detail"} className="bg-muted/30">
                        <TableCell colSpan={9} className="p-3">
                          <div className="grid md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-semibold mb-1">Conceptos pagados</p>
                              {(p.payment_items || []).map((it: any) => (
                                <div key={it.id} className="flex justify-between border-b py-1">
                                  <span>
                                    {it.payment_plan_concepts?.payment_concepts?.name || "Concepto"}{it.is_partial ? " (parcial)" : ""}
                                    {(it.student_id || p.student_id) && (
                                      <span className="text-muted-foreground"> · {studentNames[it.student_id || p.student_id] || "Estudiante"}</span>
                                    )}
                                  </span>
                                  <span className="font-medium">{Number(it.amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="font-semibold mb-1">Formas de pago</p>
                              {(p.payment_method_entries || []).map((m: any) => (
                                <div key={m.id} className="border-b py-1">
                                  <div className="flex justify-between">
                                    <span>{methodLabel(m.method)} {m.bank_name ? `· ${m.bank_name}` : ""}</span>
                                    <span className="font-medium">{Number(m.amount_original).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {m.currency}</span>
                                  </div>
                                  {m.reference_code && <div className="text-muted-foreground">Ref: {m.reference_code}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                          {p.observations && <p className="mt-2 text-xs text-muted-foreground">Obs: {p.observations}</p>}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Eliminar pago</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el pago y restaurará los saldos pendientes de los conceptos asociados de cada estudiante. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDeleteId && deleteMut.mutate(confirmDeleteId)}
                disabled={deleteMut.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {editPaymentId && (
          <EditPaymentModal
            open={!!editPaymentId}
            onOpenChange={(v) => !v && setEditPaymentId(null)}
            paymentId={editPaymentId}
            schoolId={schoolId}
            schoolYearId={schoolYearId}
            onSaved={() => setEditPaymentId(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
