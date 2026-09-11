import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { calcFinalAmount } from "@/lib/planConceptAmount";
import { friendlyPaymentConfigError } from "@/lib/paymentConfigErrors";

export interface ConceptOption {
  id: string;
  name: string;
  concept_type: string;
  default_amount: number | null;
  currency: string | null;
}

interface PlanConceptRow {
  id: string;
  concept_id: string;
  amount: number | null;
  currency: string | null;
  display_order: number | null;
  is_mandatory: boolean;
  is_recurring: boolean;
  due_day: number | null;
  due_month: number | null;
  discount_type: string | null;
  discount_value: number | null;
  payment_concepts: Pick<ConceptOption, "name" | "concept_type" | "default_amount" | "currency"> | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: { id: string; name: string };
  /** Año escolar del plan, para dejar claro qué cuotas se modifican. */
  yearLabel: string;
  allConcepts: ConceptOption[];
}

const emptyForm = {
  concept_id: "", amount: "", currency: "VES", display_order: "0", is_mandatory: true, is_recurring: false,
  due_day: "", due_month: "", discount_type: "none", discount_value: "",
};

/**
 * Cuotas (conceptos) de un plan. El plan pertenece a un solo año escolar, así que editar monto,
 * descuento o moneda aquí solo recalcula las cuotas **sin pagos** de ese año (trigger
 * `sync_unpaid_balances_for_plan_concept`); los demás años no se tocan.
 */
export function PlanConceptsDialog({ open, onOpenChange, plan, yearLabel, allConcepts }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: planConcepts = [], isLoading } = useQuery({
    queryKey: ["plan-concepts", plan.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_plan_concepts").select("*, payment_concepts(name, concept_type, default_amount, currency)").eq("plan_id", plan.id).order("display_order");
      if (error) throw error;
      return (data || []) as unknown as PlanConceptRow[];
    },
    enabled: open,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editPcId, setEditPcId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(emptyForm);

  const closeAddDialog = () => { setAddOpen(false); setEditPcId(null); setAddForm(emptyForm); };

  const openEditPc = (pc: PlanConceptRow) => {
    setEditPcId(pc.id);
    setAddForm({
      concept_id: pc.concept_id,
      amount: pc.amount?.toString() || "0",
      currency: pc.currency || pc.payment_concepts?.currency || "VES",
      display_order: pc.display_order?.toString() || "0",
      is_mandatory: pc.is_mandatory,
      is_recurring: pc.is_recurring,
      due_day: pc.due_day?.toString() || "",
      due_month: pc.due_month?.toString() || "",
      discount_type: pc.discount_type || "none",
      discount_value: pc.discount_value ? pc.discount_value.toString() : "",
    });
    setAddOpen(true);
  };

  // Cambiar el plan recalcula las cuotas sin pagos de ese año: se refrescan las vistas de saldos
  const invalidateAfterChange = () => {
    qc.invalidateQueries({ queryKey: ["plan-concepts", plan.id] });
    qc.invalidateQueries({ queryKey: ["payment-plans"] });
    qc.invalidateQueries({ queryKey: ["all-student-balances"] });
    qc.invalidateQueries({ queryKey: ["student-balances"] });
    qc.invalidateQueries({ queryKey: ["family-students-balances"] });
  };

  const addConcept = useMutation({
    mutationFn: async () => {
      const payload = {
        amount: parseFloat(addForm.amount) || 0,
        currency: addForm.currency,
        display_order: parseInt(addForm.display_order) || 0,
        is_mandatory: addForm.is_mandatory,
        is_recurring: addForm.is_recurring,
        due_day: addForm.due_day ? parseInt(addForm.due_day) : null,
        due_month: addForm.due_month ? parseInt(addForm.due_month) : null,
        discount_type: addForm.discount_type,
        discount_value: parseFloat(addForm.discount_value) || 0,
      };
      if (editPcId) {
        const { error } = await supabase.from("payment_plan_concepts").update(payload).eq("id", editPcId);
        if (error) throw error;
      } else {
        if (!addForm.concept_id) throw new Error("Seleccione un concepto");
        const { error } = await supabase.from("payment_plan_concepts").insert({ ...payload, plan_id: plan.id, concept_id: addForm.concept_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAfterChange();
      toast({ title: editPcId ? "Concepto actualizado" : "Concepto agregado al plan" });
      closeAddDialog();
    },
    onError: (e: unknown) => toast({ title: "Error", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const removeConcept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_plan_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAfterChange();
      toast({ title: "Concepto removido del plan" });
    },
    onError: (e: unknown) => toast({ title: "No se pudo quitar el concepto", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const updateConcept = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { due_month?: number | null; due_day?: number | null } }) => {
      const { error } = await supabase.from("payment_plan_concepts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAfterChange();
      toast({ title: "Vencimiento actualizado" });
    },
    onError: (e: unknown) => toast({ title: "Error", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const confirmRemove = (pc: PlanConceptRow) => {
    const name = pc.payment_concepts?.name || "este concepto";
    if (window.confirm(`¿Quitar "${name}" del plan ${plan.name} (${yearLabel})? Se eliminarán sus cuotas pendientes sin pagos de ese año.`)) {
      removeConcept.mutate(pc.id);
    }
  };

  const existingConceptIds = new Set(planConcepts.map((pc) => pc.concept_id));
  const availableConcepts = allConcepts.filter((c) => !existingConceptIds.has(c.id));
  const totalsByCurrency = planConcepts.reduce((acc: Record<string, number>, pc) => {
    const cur = pc.currency || pc.payment_concepts?.currency || "VES";
    const final = calcFinalAmount(pc.amount || 0, pc.discount_type || "none", pc.discount_value || 0);
    acc[cur] = (acc[cur] || 0) + final;
    return acc;
  }, {});

  const handleConceptSelect = (conceptId: string) => {
    const concept = allConcepts.find((c) => c.id === conceptId);
    setAddForm({ ...addForm, concept_id: conceptId, amount: concept?.default_amount?.toString() || "0", currency: concept?.currency || "VES" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Ancho para que quepan todas las columnas (vencimientos y acciones) sin scroll horizontal */}
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Conceptos del Plan: {plan.name} <span className="text-muted-foreground font-normal">({yearLabel})</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <p className="text-xs text-muted-foreground">
            Estos montos son los de {yearLabel}. Al cambiarlos se recalculan las cuotas sin pagos de ese año; las ya
            abonadas conservan su precio y los demás años no cambian.
          </p>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Total del plan: <span className="font-bold text-foreground">{Object.entries(totalsByCurrency).map(([cur, amt]) => `${amt.toLocaleString("es-VE", { minimumFractionDigits: 2 })} ${cur}`).join(" + ") || "0,00 VES"}</span></p>
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
                  <TableHead>Monto / Descuento</TableHead>
                  <TableHead>Obligatorio</TableHead>
                  <TableHead>Recurrente</TableHead>
                  <TableHead>Mes venc.</TableHead>
                  <TableHead>Día venc.</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planConcepts.map((pc) => {
                  const cur = pc.currency || pc.payment_concepts?.currency || "VES";
                  const discType = pc.discount_type || "none";
                  const discVal = pc.discount_value || 0;
                  const baseAmt = pc.amount || 0;
                  const finalAmt = calcFinalAmount(baseAmt, discType, discVal);
                  return (
                    <TableRow key={pc.id}>
                      <TableCell className="font-medium whitespace-nowrap">{pc.payment_concepts?.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{pc.payment_concepts?.concept_type}</Badge></TableCell>
                      <TableCell>
                        {discType === "none" ? (
                          <span>{baseAmt.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur}</span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground line-through">
                              {baseAmt.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur}
                            </div>
                            <div className="font-medium text-sm">
                              {finalAmt.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur}
                            </div>
                            <Badge variant="secondary" className="text-xs py-0 px-1.5 text-green-700 bg-green-100">
                              {discType === "percentage" ? `-${discVal}%` : `-${discVal} ${cur}`}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{pc.is_mandatory ? "Sí" : "No"}</TableCell>
                      <TableCell>{pc.is_recurring ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        <Select
                          value={pc.due_month ? String(pc.due_month) : "none"}
                          onValueChange={(v) => updateConcept.mutate({ id: pc.id, patch: { due_month: v === "none" ? null : parseInt(v) } })}
                        >
                          <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                              <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          defaultValue={pc.due_day ?? ""}
                          className="h-8 w-16"
                          onBlur={(e) => {
                            const v = e.target.value;
                            const newVal = v ? parseInt(v) : null;
                            if (newVal !== (pc.due_day ?? null)) {
                              updateConcept.mutate({ id: pc.id, patch: { due_day: newVal } });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditPc(pc)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => confirmRemove(pc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {planConcepts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin conceptos asociados</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add / Edit concept sub-dialog */}
        <Dialog open={addOpen} onOpenChange={(v) => { if (!v) closeAddDialog(); else setAddOpen(v); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editPcId ? "Editar Concepto del Plan" : "Agregar Concepto al Plan"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {!editPcId && (
                <div className="space-y-1">
                  <Label>Concepto *</Label>
                  <Select value={addForm.concept_id} onValueChange={handleConceptSelect}>
                    <SelectTrigger><SelectValue placeholder="Seleccione un concepto" /></SelectTrigger>
                    <SelectContent>
                      {availableConcepts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.concept_type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Moneda *</Label>
                  <Select value={addForm.currency} onValueChange={(v) => setAddForm({ ...addForm, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VES">VES</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="COP">COP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Monto ({addForm.currency}) *</Label>
                  <Input type="number" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Día de vencimiento</Label>
                  <Input type="number" min="1" max="31" value={addForm.due_day} onChange={(e) => setAddForm({ ...addForm, due_day: e.target.value })} placeholder="ej: 15" />
                </div>
              </div>
              {editPcId && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Se aplica a las cuotas sin pagos de {yearLabel}. Si cambia la moneda, esas cuotas pasan a la nueva
                  moneda con la tasa de hoy.
                </p>
              )}

              {/* Discount section */}
              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                <Label className="text-sm font-medium">Descuento</Label>
                <RadioGroup
                  value={addForm.discount_type}
                  onValueChange={(v) => setAddForm({ ...addForm, discount_type: v, discount_value: "" })}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="none" id="d-none" />
                    <Label htmlFor="d-none" className="font-normal cursor-pointer">Sin descuento</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="percentage" id="d-pct" />
                    <Label htmlFor="d-pct" className="font-normal cursor-pointer">Porcentual (%)</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="fixed" id="d-fixed" />
                    <Label htmlFor="d-fixed" className="font-normal cursor-pointer">Fijo ({addForm.currency})</Label>
                  </div>
                </RadioGroup>

                {addForm.discount_type !== "none" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={addForm.discount_type === "percentage" ? "100" : undefined}
                        value={addForm.discount_value}
                        onChange={(e) => setAddForm({ ...addForm, discount_value: e.target.value })}
                        className="h-8 w-28"
                        placeholder={addForm.discount_type === "percentage" ? "ej: 10" : "ej: 5"}
                      />
                      <span className="text-sm text-muted-foreground">
                        {addForm.discount_type === "percentage" ? "%" : addForm.currency}
                      </span>
                    </div>
                    {addForm.amount && addForm.discount_value && (
                      <div className="text-sm flex items-center gap-1.5">
                        <span className="text-muted-foreground line-through">
                          {parseFloat(addForm.amount).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="font-semibold text-green-700">
                          {calcFinalAmount(
                            parseFloat(addForm.amount),
                            addForm.discount_type,
                            parseFloat(addForm.discount_value)
                          ).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {addForm.currency}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Mes de vencimiento</Label>
                  <Select value={addForm.due_month || "none"} onValueChange={(v) => setAddForm({ ...addForm, due_month: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin mes específico" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin mes específico</SelectItem>
                      {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                        <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Si recurrente, indica el primer mes de obligación.</p>
                </div>
                <div className="space-y-1"><Label>Orden</Label><Input type="number" value={addForm.display_order} onChange={(e) => setAddForm({ ...addForm, display_order: e.target.value })} /></div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><Checkbox checked={addForm.is_mandatory} onCheckedChange={(v) => setAddForm({ ...addForm, is_mandatory: !!v })} /><Label>Obligatorio</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={addForm.is_recurring} onCheckedChange={(v) => setAddForm({ ...addForm, is_recurring: !!v })} /><Label>Recurrente</Label></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeAddDialog}>Cancelar</Button>
              <Button onClick={() => addConcept.mutate()} disabled={addConcept.isPending}>
                {addConcept.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
                {editPcId ? "Guardar cambios" : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
