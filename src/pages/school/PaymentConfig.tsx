import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Package, FileText, Link2, CreditCard } from "lucide-react";
import { PaymentMethodsTab } from "@/components/payments/PaymentMethodsTab";

// ─── Concepts Tab ───
function ConceptsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", concept_type: "mensualidad", default_amount: "", currency: "VES", is_active: true });

  const { data: concepts = [], isLoading } = useQuery({
    queryKey: ["payment-concepts", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_concepts").select("*").eq("school_id", schoolId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nombre requerido");
      const payload = {
        school_id: schoolId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        concept_type: form.concept_type,
        default_amount: parseFloat(form.default_amount) || 0,
        currency: form.currency,
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from("payment_concepts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_concepts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-concepts"] });
      toast({ title: editId ? "Concepto actualizado" : "Concepto creado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-concepts"] });
      toast({ title: "Concepto eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm({ name: "", description: "", concept_type: "mensualidad", default_amount: "", currency: "VES", is_active: true }); };
  const openEdit = (c: any) => { setEditId(c.id); setForm({ name: c.name, description: c.description || "", concept_type: c.concept_type, default_amount: c.default_amount?.toString() || "0", currency: c.currency || "VES", is_active: c.is_active }); setOpen(true); };

  const typeLabels: Record<string, string> = { inscripcion: "Inscripción", mensualidad: "Mensualidad", uniforme: "Uniforme", transporte: "Transporte", laboratorio: "Laboratorio", otro: "Otro" };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Conceptos de Pago</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Concepto</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Monto por defecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concepts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabels[c.concept_type] || c.concept_type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{c.currency || "VES"}</Badge></TableCell>
                  <TableCell>{c.default_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {c.currency || "VES"}</TableCell>
                  <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {concepts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay conceptos registrados</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Concepto" : "Nuevo Concepto"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.concept_type} onValueChange={(v) => setForm({ ...form, concept_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VES">VES (Bs.)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="COP">COP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Monto por defecto ({form.currency})</Label><Input type="number" step="0.01" value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Plans Tab ───
function PlansTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", is_active: true });
  const [assocOpen, setAssocOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["payment-plans", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_plans").select("*, payment_plan_concepts(id, amount, currency, display_order, is_mandatory, is_recurring, due_day, concept_id, payment_concepts(name, concept_type, currency))").eq("school_id", schoolId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allConcepts = [] } = useQuery({
    queryKey: ["payment-concepts", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_concepts").select("*").eq("school_id", schoolId).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nombre requerido");
      const payload = { school_id: schoolId, name: form.name.trim(), description: form.description.trim() || null, is_active: form.is_active };
      if (editId) {
        const { error } = await supabase.from("payment_plans").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-plans"] }); toast({ title: editId ? "Plan actualizado" : "Plan creado" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-plans"] }); toast({ title: "Plan eliminado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm({ name: "", description: "", is_active: true }); };
  const openEdit = (p: any) => { setEditId(p.id); setForm({ name: p.name, description: p.description || "", is_active: p.is_active }); setOpen(true); };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Planes de Pago</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Plan</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
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
                {plans.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.payment_plan_concepts?.length || 0} conceptos</Badge>
                    </TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedPlan(p); setAssocOpen(true); }}><Link2 className="h-4 w-4 text-primary" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deletePlan.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay planes registrados</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan CRUD Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Plan" : "Nuevo Plan"}</DialogTitle></DialogHeader>
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
          allConcepts={allConcepts}
          schoolId={schoolId}
        />
      )}
    </>
  );
}

// ─── Plan-Concepts Association Dialog ───
function PlanConceptsDialog({ open, onOpenChange, plan, allConcepts, schoolId }: {
  open: boolean; onOpenChange: (v: boolean) => void; plan: any; allConcepts: any[]; schoolId: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: planConcepts = [], isLoading } = useQuery({
    queryKey: ["plan-concepts", plan.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_plan_concepts").select("*, payment_concepts(name, concept_type, default_amount, currency)").eq("plan_id", plan.id).order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ concept_id: "", amount: "", currency: "VES", display_order: "0", is_mandatory: true, is_recurring: false, due_day: "" });

  const addConcept = useMutation({
    mutationFn: async () => {
      if (!addForm.concept_id) throw new Error("Seleccione un concepto");
      const { error } = await supabase.from("payment_plan_concepts").insert({
        plan_id: plan.id,
        concept_id: addForm.concept_id,
        amount: parseFloat(addForm.amount) || 0,
        currency: addForm.currency,
        display_order: parseInt(addForm.display_order) || 0,
        is_mandatory: addForm.is_mandatory,
        is_recurring: addForm.is_recurring,
        due_day: addForm.due_day ? parseInt(addForm.due_day) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-concepts", plan.id] });
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
      toast({ title: "Concepto agregado al plan" });
      setAddOpen(false);
      setAddForm({ concept_id: "", amount: "", currency: "VES", display_order: "0", is_mandatory: true, is_recurring: false, due_day: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeConcept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_plan_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-concepts", plan.id] });
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
      toast({ title: "Concepto removido del plan" });
    },
  });

  const existingConceptIds = new Set(planConcepts.map((pc: any) => pc.concept_id));
  const availableConcepts = allConcepts.filter((c) => !existingConceptIds.has(c.id));
  const totalsByCurrency = planConcepts.reduce((acc: Record<string, number>, pc: any) => {
    const cur = pc.currency || pc.payment_concepts?.currency || "VES";
    acc[cur] = (acc[cur] || 0) + (pc.amount || 0);
    return acc;
  }, {});

  const handleConceptSelect = (conceptId: string) => {
    const concept = allConcepts.find((c) => c.id === conceptId);
    setAddForm({ ...addForm, concept_id: conceptId, amount: concept?.default_amount?.toString() || "0", currency: concept?.currency || "VES" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Conceptos del Plan: {plan.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Total del plan: <span className="font-bold text-foreground">{Object.entries(totalsByCurrency).map(([cur, amt]) => `${(amt as number).toLocaleString("es-VE", { minimumFractionDigits: 2 })} ${cur}`).join(" + ") || "0,00 VES"}</span></p>
            <Button size="sm" onClick={() => setAddOpen(true)} disabled={availableConcepts.length === 0}>
              <Plus className="h-4 w-4 mr-1" />Agregar Concepto
            </Button>
          </div>

          {isLoading ? <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Obligatorio</TableHead>
                  <TableHead>Recurrente</TableHead>
                  <TableHead>Día venc.</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planConcepts.map((pc: any) => {
                  const cur = pc.currency || pc.payment_concepts?.currency || "VES";
                  return (
                    <TableRow key={pc.id}>
                      <TableCell className="font-medium">{pc.payment_concepts?.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{pc.payment_concepts?.concept_type}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{cur}</Badge></TableCell>
                      <TableCell>{pc.amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur}</TableCell>
                      <TableCell>{pc.is_mandatory ? "Sí" : "No"}</TableCell>
                      <TableCell>{pc.is_recurring ? "Sí" : "No"}</TableCell>
                      <TableCell>{pc.due_day || "—"}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeConcept.mutate(pc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {planConcepts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin conceptos asociados</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add concept sub-dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Agregar Concepto al Plan</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1">
                <Label>Concepto *</Label>
                <Select value={addForm.concept_id} onValueChange={handleConceptSelect}>
                  <SelectTrigger><SelectValue placeholder="Seleccione un concepto" /></SelectTrigger>
                  <SelectContent>
                    {availableConcepts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.concept_type})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Monto (VES) *</Label><Input type="number" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} /></div>
                <div className="space-y-1"><Label>Día de vencimiento</Label><Input type="number" min="1" max="31" value={addForm.due_day} onChange={(e) => setAddForm({ ...addForm, due_day: e.target.value })} placeholder="ej: 15" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Orden</Label><Input type="number" value={addForm.display_order} onChange={(e) => setAddForm({ ...addForm, display_order: e.target.value })} /></div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><Checkbox checked={addForm.is_mandatory} onCheckedChange={(v) => setAddForm({ ...addForm, is_mandatory: !!v })} /><Label>Obligatorio</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={addForm.is_recurring} onCheckedChange={(v) => setAddForm({ ...addForm, is_recurring: !!v })} /><Label>Recurrente</Label></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => addConcept.mutate()} disabled={addConcept.isPending}>{addConcept.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Agregar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function PaymentConfig() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Configuración de Pagos" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Configuración" }]} />
      <Tabs defaultValue="concepts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="concepts" className="gap-2"><Package className="h-4 w-4" />Conceptos</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2"><FileText className="h-4 w-4" />Planes</TabsTrigger>
          <TabsTrigger value="methods" className="gap-2"><CreditCard className="h-4 w-4" />Métodos de Pago</TabsTrigger>
        </TabsList>
        <TabsContent value="concepts"><ConceptsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="plans"><PlansTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="methods"><PaymentMethodsTab schoolId={schoolId} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
