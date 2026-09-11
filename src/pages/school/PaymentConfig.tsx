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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Package, FileText, CreditCard, Settings } from "lucide-react";
import { PaymentMethodsTab } from "@/components/payments/PaymentMethodsTab";
import { PaymentSettingsTab } from "@/components/payments/PaymentSettingsTab";
import { PaymentPlansTab } from "@/components/payments/PaymentPlansTab";
import { friendlyPaymentConfigError } from "@/lib/paymentConfigErrors";

// ─── Concepts Tab ───
// Catálogo del colegio (nombre + tipo). El monto y la moneda de aquí son solo la sugerencia al
// agregar el concepto a un plan: el precio real de cada año vive en los planes de ese año.
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
    onError: (e: unknown) => toast({ title: "Error", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-concepts"] });
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
      toast({ title: "Concepto eliminado" });
    },
    onError: (e: unknown) => toast({ title: "No se pudo eliminar el concepto", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const confirmDelete = (c: { id: string; name: string }) => {
    if (window.confirm(`¿Eliminar el concepto "${c.name}"? Se quitará de todos los planes (de todos los años) junto con sus cuotas pendientes sin pagos. Si ya tiene pagos o exoneraciones no se podrá eliminar.`)) {
      deleteMut.mutate(c.id);
    }
  };

  const closeDialog = () => { setOpen(false); setEditId(null); setForm({ name: "", description: "", concept_type: "mensualidad", default_amount: "", currency: "VES", is_active: true }); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEdit = (c: any) => { setEditId(c.id); setForm({ name: c.name, description: c.description || "", concept_type: c.concept_type, default_amount: c.default_amount?.toString() || "0", currency: c.currency || "VES", is_active: c.is_active }); setOpen(true); };

  const typeLabels: Record<string, string> = { inscripcion: "Inscripción", mensualidad: "Mensualidad", uniforme: "Uniforme", transporte: "Transporte", laboratorio: "Laboratorio", seguro_escolar: "Seguro Escolar", otro: "Otro" };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Conceptos de Pago</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            El monto y la moneda son solo la sugerencia al agregar el concepto a un plan; el precio de cada año se
            define en la pestaña Planes.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Concepto</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda sugerida</TableHead>
                <TableHead>Monto sugerido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concepts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabels[c.concept_type] || c.concept_type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{c.currency || "VES"}</Badge></TableCell>
                  <TableCell>{c.default_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {c.currency || "VES"}</TableCell>
                  <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirmDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                <Label>Moneda sugerida</Label>
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
              <div className="space-y-1"><Label>Monto sugerido ({form.currency})</Label><Input type="number" step="0.01" value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cambiar estos valores no modifica ningún plan ni cuota existente.
            </p>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Configuraciones</TabsTrigger>
        </TabsList>
        <TabsContent value="concepts"><ConceptsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="plans"><PaymentPlansTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="methods"><PaymentMethodsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="settings"><PaymentSettingsTab schoolId={schoolId} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
