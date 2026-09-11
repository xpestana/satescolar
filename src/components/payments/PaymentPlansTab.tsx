import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Link2, Copy } from "lucide-react";
import { SchoolYearSelect } from "@/components/payments/SchoolYearSelect";
import { PlanConceptsDialog, type ConceptOption } from "@/components/payments/PlanConceptsDialog";
import { CopyPaymentPlansDialog } from "@/components/payments/CopyPaymentPlansDialog";
import { useSchoolYearSelection } from "@/hooks/useSchoolYearSelection";
import { friendlyPaymentConfigError } from "@/lib/paymentConfigErrors";

interface PaymentPlanRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  school_year_id: string;
  payment_plan_concepts: { id: string }[] | null;
}

const emptyForm = { name: "", description: "", is_active: true };

/**
 * Pestaña "Planes" de Configuración de Pagos. Cada plan pertenece a un **año escolar**: los planes
 * del año nuevo se crean o se copian del anterior y se les ajustan montos/moneda sin tocar las
 * cuotas de otros años (ver migración `20260911120000_payment_plans_per_school_year.sql`).
 */
export function PaymentPlansTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [assocOpen, setAssocOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanRow | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const { schoolYears, selectedYearId, setSelectedYearId, selectedYear, isLoading: yearsLoading } =
    useSchoolYearSelection(schoolId);
  const yearLabel = selectedYear?.year_range ?? "";

  // Al cambiar de año no debe quedar abierto un plan del año anterior
  useEffect(() => {
    setAssocOpen(false);
    setSelectedPlan(null);
    setCopyOpen(false);
  }, [selectedYearId]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["payment-plans", schoolId, selectedYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plans")
        .select("id, name, description, is_active, school_year_id, payment_plan_concepts(id)")
        .eq("school_id", schoolId)
        .eq("school_year_id", selectedYearId)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as PaymentPlanRow[];
    },
    enabled: !!selectedYearId,
  });

  const { data: allConcepts = [] } = useQuery({
    queryKey: ["payment-concepts", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_concepts").select("*").eq("school_id", schoolId).eq("is_active", true).order("name");
      if (error) throw error;
      return (data || []) as unknown as ConceptOption[];
    },
  });

  const invalidatePlans = () => {
    qc.invalidateQueries({ queryKey: ["payment-plans"] });
    qc.invalidateQueries({ queryKey: ["available-plans"] });
    qc.invalidateQueries({ queryKey: ["payments-report-plans"] });
  };

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nombre requerido");
      if (!selectedYearId) throw new Error("Seleccione un año escolar");
      const payload = { name: form.name.trim(), description: form.description.trim() || null, is_active: form.is_active };
      if (editId) {
        const { error } = await supabase.from("payment_plans").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_plans").insert({ ...payload, school_id: schoolId, school_year_id: selectedYearId });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidatePlans(); toast({ title: editId ? "Plan actualizado" : "Plan creado" }); closeDialog(); },
    onError: (e: unknown) => toast({ title: "Error", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePlans();
      qc.invalidateQueries({ queryKey: ["all-student-plans"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      toast({ title: "Plan eliminado" });
    },
    onError: (e: unknown) => toast({ title: "No se pudo eliminar el plan", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const confirmDelete = (p: PaymentPlanRow) => {
    if (window.confirm(`¿Eliminar el plan "${p.name}" de ${yearLabel}? Se quitará a los estudiantes de ese año y sus cuotas pendientes sin pagos. Si ya tiene pagos o exoneraciones no se podrá eliminar.`)) {
      deletePlan.mutate(p.id);
    }
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (p: PaymentPlanRow) => { setEditId(p.id); setForm({ name: p.name, description: p.description || "", is_active: p.is_active }); setOpen(true); };

  return (
    <>
      <SchoolYearSelect
        years={schoolYears}
        value={selectedYearId}
        onChange={setSelectedYearId}
        isLoading={yearsLoading}
        inactiveWarning="Está configurando los planes de {year}, que no es el año en curso"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Planes de Pago {yearLabel && <span className="text-muted-foreground font-normal">— {yearLabel}</span>}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Los planes y sus montos son de este año escolar: cambiarlos no afecta las cuotas de otros años.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)} disabled={!selectedYear || schoolYears.length < 2}>
              <Copy className="h-4 w-4 mr-1" />Copiar de otro año
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} disabled={!selectedYearId}><Plus className="h-4 w-4 mr-1" />Nuevo Plan</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || !selectedYearId ? <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Conceptos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-32">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.payment_plan_concepts?.length || 0} conceptos</Badge>
                    </TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Editar plan" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Conceptos y montos" onClick={() => { setSelectedPlan(p); setAssocOpen(true); }}><Link2 className="h-4 w-4 text-primary" /></Button>
                        <Button size="icon" variant="ghost" title="Eliminar plan" onClick={() => confirmDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay planes en {yearLabel}. Use «Copiar de otro año» para traer los del año anterior y ajustar sus montos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan CRUD Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Plan" : `Nuevo Plan (${yearLabel})`}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>{savePlan.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Association Dialog */}
      {selectedPlan && (
        <PlanConceptsDialog
          open={assocOpen}
          onOpenChange={(v) => { setAssocOpen(v); if (!v) setSelectedPlan(null); }}
          plan={selectedPlan}
          yearLabel={yearLabel}
          allConcepts={allConcepts}
        />
      )}

      {selectedYear && (
        <CopyPaymentPlansDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          schoolId={schoolId}
          years={schoolYears}
          targetYear={selectedYear}
          existingNames={plans.map((p) => p.name)}
        />
      )}
    </>
  );
}
