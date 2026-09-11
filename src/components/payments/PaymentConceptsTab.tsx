import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, Copy } from "lucide-react";
import { SchoolYearSelect } from "@/components/payments/SchoolYearSelect";
import { CopyFromYearDialog, type CopyableItem } from "@/components/payments/CopyFromYearDialog";
import { useSchoolYearSelection } from "@/hooks/useSchoolYearSelection";
import { friendlyPaymentConfigError } from "@/lib/paymentConfigErrors";

interface PaymentConceptRow {
  id: string;
  name: string;
  description: string | null;
  concept_type: string;
  default_amount: number | null;
  currency: string | null;
  is_active: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  inscripcion: "Inscripción", mensualidad: "Mensualidad", uniforme: "Uniforme", transporte: "Transporte",
  laboratorio: "Laboratorio", seguro_escolar: "Seguro Escolar", otro: "Otro",
};

const emptyForm = { name: "", description: "", concept_type: "mensualidad", default_amount: "", currency: "VES", is_active: true };

const money = (amount: number | null, currency: string | null) =>
  `${(amount ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} ${currency || "VES"}`;

/**
 * Pestaña "Conceptos" de Configuración de Pagos. Cada año escolar tiene sus conceptos con su monto
 * y moneda. Cambiar el precio de un concepto actualiza las cuotas de los planes de ese año que lo
 * usaban con el precio anterior y sus cuotas sin pagos (triggers
 * `trg_propagate_payment_concept_price` → `trg_sync_balances_on_payment_plan_concept`); los demás
 * años no cambian.
 */
export function PaymentConceptsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [copyOpen, setCopyOpen] = useState(false);

  const { schoolYears, selectedYearId, setSelectedYearId, selectedYear, isLoading: yearsLoading } =
    useSchoolYearSelection(schoolId);
  const yearLabel = selectedYear?.year_range ?? "";

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };

  // Al cambiar de año no debe quedar abierto un concepto del año anterior
  useEffect(() => {
    setOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setCopyOpen(false);
  }, [selectedYearId]);

  const { data: concepts = [], isLoading } = useQuery({
    queryKey: ["payment-concepts", schoolId, selectedYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_concepts")
        .select("id, name, description, concept_type, default_amount, currency, is_active")
        .eq("school_id", schoolId)
        .eq("school_year_id", selectedYearId)
        .order("name");
      if (error) throw error;
      return (data || []) as PaymentConceptRow[];
    },
    enabled: !!selectedYearId,
  });

  // En cuántos planes del año está cada concepto
  const { data: usageRows = [] } = useQuery({
    queryKey: ["payment-concepts-usage", schoolId, selectedYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plan_concepts")
        .select("concept_id, payment_plans!inner(school_id, school_year_id)")
        .eq("payment_plans.school_id", schoolId)
        .eq("payment_plans.school_year_id", selectedYearId);
      if (error) throw error;
      return (data || []) as { concept_id: string }[];
    },
    enabled: !!selectedYearId,
  });
  const usageByConcept = useMemo(() => {
    const map: Record<string, number> = {};
    usageRows.forEach((r) => { map[r.concept_id] = (map[r.concept_id] || 0) + 1; });
    return map;
  }, [usageRows]);

  // El precio del concepto llega a los planes y a las cuotas sin pagos de ese año
  const invalidateAll = () => {
    ["payment-concepts", "payment-concepts-usage", "plan-concept-options", "payment-concepts-invoice", "payment-plans",
      "plan-concepts", "all-student-balances", "student-balances", "family-students-balances"]
      .forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nombre requerido");
      if (!selectedYearId) throw new Error("Seleccione un año escolar");
      const payload = {
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
        // Un concepto nuevo inicia su propio linaje (sus copias en otros años lo heredarán)
        const id = crypto.randomUUID();
        const { error } = await supabase.from("payment_concepts").insert({ ...payload, id, lineage_id: id, school_id: schoolId, school_year_id: selectedYearId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast(editId
        ? { title: "Concepto actualizado", description: `Se aplicó a los planes de ${yearLabel} que usaban el precio anterior y a sus cuotas sin pagos.` }
        : { title: "Concepto creado" });
      closeDialog();
    },
    onError: (e: unknown) => toast({ title: "Error", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Concepto eliminado" }); },
    onError: (e: unknown) => toast({ title: "No se pudo eliminar el concepto", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const confirmDelete = (c: PaymentConceptRow) => {
    if (window.confirm(`¿Eliminar el concepto "${c.name}" de ${yearLabel}? Se quitará de los planes de ese año junto con sus cuotas pendientes sin pagos. Si ya tiene pagos o exoneraciones no se podrá eliminar.`)) {
      deleteMut.mutate(c.id);
    }
  };

  const openEdit = (c: PaymentConceptRow) => {
    setEditId(c.id);
    setForm({
      name: c.name, description: c.description || "", concept_type: c.concept_type,
      default_amount: c.default_amount?.toString() || "0", currency: c.currency || "VES", is_active: c.is_active,
    });
    setOpen(true);
  };

  const fetchSourceConcepts = async (fromYearId: string): Promise<CopyableItem[]> => {
    const { data, error } = await supabase
      .from("payment_concepts")
      .select("id, name, default_amount, currency, is_active")
      .eq("school_id", schoolId)
      .eq("school_year_id", fromYearId)
      .order("name");
    if (error) throw error;
    return (data || []).map((c) => ({ id: c.id, name: c.name, detail: money(c.default_amount, c.currency), inactive: !c.is_active }));
  };

  const copyConcepts = async (fromYearId: string, ids: string[]) => {
    const { data, error } = await supabase.rpc("copy_payment_concepts_to_year", {
      _school_id: schoolId, _from_year_id: fromYearId, _to_year_id: selectedYearId, _concept_ids: ids,
    });
    if (error) throw error;
    return (data as number | null) ?? 0;
  };

  const editingUsage = editId ? usageByConcept[editId] || 0 : 0;

  return (
    <>
      <SchoolYearSelect
        years={schoolYears}
        value={selectedYearId}
        onChange={setSelectedYearId}
        isLoading={yearsLoading}
        inactiveWarning="Está configurando los conceptos de {year}, que no es el año en curso"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Conceptos de Pago {yearLabel && <span className="text-muted-foreground font-normal">— {yearLabel}</span>}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Monto y moneda de {yearLabel || "este año"}. Al cambiarlos se actualizan los planes de este año y sus cuotas sin
              pagos; los demás años no cambian.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)} disabled={!selectedYear || schoolYears.length < 2}>
              <Copy className="h-4 w-4 mr-1" />Copiar de otro año
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} disabled={!selectedYearId}><Plus className="h-4 w-4 mr-1" />Nuevo Concepto</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || !selectedYearId ? <div className="space-y-3 py-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>En planes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {concepts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[c.concept_type] || c.concept_type}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{c.currency || "VES"}</Badge></TableCell>
                    <TableCell>{money(c.default_amount, c.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{usageByConcept[c.id] || 0}</TableCell>
                    <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Editar concepto" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Eliminar concepto" onClick={() => confirmDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {concepts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay conceptos en {yearLabel}. Use «Copiar de otro año» para traer los del año anterior y ajustar sus montos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? `Editar Concepto (${yearLabel})` : `Nuevo Concepto (${yearLabel})`}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.concept_type} onValueChange={(v) => setForm({ ...form, concept_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              <div className="space-y-1"><Label>Monto ({form.currency})</Label><Input type="number" step="0.01" value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: e.target.value })} /></div>
            </div>
            {editId && (
              <p className="text-xs text-muted-foreground">
                Está en {editingUsage} plan{editingUsage === 1 ? "" : "es"} de {yearLabel}. Al guardar un monto o moneda nuevos se
                actualizan las cuotas de esos planes que tenían el precio anterior y sus cuotas sin pagos (a la tasa de hoy si
                cambia la moneda). Las cuotas ya abonadas y los demás años no cambian.
              </p>
            )}
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedYear && (
        <CopyFromYearDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          years={schoolYears}
          targetYear={selectedYear}
          noun={{ singular: "concepto", plural: "conceptos" }}
          description={`Se duplican los conceptos con su monto y moneda. Luego puede cambiarlos para ${selectedYear.year_range} sin afectar al año de origen.`}
          existingNames={concepts.map((c) => c.name)}
          queryKeyBase={["copy-concepts-source", schoolId]}
          fetchItems={fetchSourceConcepts}
          copyItems={copyConcepts}
          onCopied={invalidateAll}
        />
      )}
    </>
  );
}
