import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useSchoolId } from "@/hooks/useSchoolId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, DollarSign, AlertTriangle, Settings2, Package } from "lucide-react";

const CONCEPT_TYPES = [
  { value: "inscripcion", label: "Inscripción" },
  { value: "mensualidad", label: "Mensualidad" },
  { value: "uniforme", label: "Uniforme" },
  { value: "transporte", label: "Transporte" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "otro", label: "Otro" },
];

const CURRENCIES = [
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "COP", label: "Peso Colombiano (COP)" },
];

const WEEK_DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export default function PaymentsConfig() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("concepts");

  // ---- CONCEPTS ----
  const [conceptModal, setConceptModal] = useState(false);
  const [editingConcept, setEditingConcept] = useState<any>(null);
  const [conceptForm, setConceptForm] = useState({ name: "", description: "", default_amount: "0", concept_type: "otro" });

  const { data: concepts = [], isLoading: conceptsLoading } = useQuery({
    queryKey: ["payment-concepts", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_concepts").select("*").eq("school_id", schoolId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const saveConcept = useMutation({
    mutationFn: async () => {
      const payload = {
        school_id: schoolId!,
        name: conceptForm.name,
        description: conceptForm.description,
        default_amount: parseFloat(conceptForm.default_amount) || 0,
        concept_type: conceptForm.concept_type,
      };
      if (editingConcept) {
        const { error } = await supabase.from("payment_concepts").update(payload).eq("id", editingConcept.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_concepts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-concepts"] });
      setConceptModal(false);
      setEditingConcept(null);
      toast.success(editingConcept ? "Concepto actualizado" : "Concepto creado");
    },
    onError: () => toast.error("Error al guardar concepto"),
  });

  const deleteConcept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-concepts"] });
      toast.success("Concepto eliminado");
    },
    onError: () => toast.error("No se puede eliminar, puede estar asociado a un plan"),
  });

  const openConceptModal = (concept?: any) => {
    if (concept) {
      setEditingConcept(concept);
      setConceptForm({ name: concept.name, description: concept.description || "", default_amount: String(concept.default_amount), concept_type: concept.concept_type });
    } else {
      setEditingConcept(null);
      setConceptForm({ name: "", description: "", default_amount: "0", concept_type: "otro" });
    }
    setConceptModal(true);
  };

  // ---- PLANS ----
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ name: "", description: "" });
  const [planConceptsModal, setPlanConceptsModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [addConceptToPlanModal, setAddConceptToPlanModal] = useState(false);
  const [newPlanConcept, setNewPlanConcept] = useState({ concept_id: "", amount: "0", is_mandatory: true, is_recurring: false, due_day: "" });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["payment-plans", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_plans").select("*").eq("school_id", schoolId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: planConcepts = [] } = useQuery({
    queryKey: ["plan-concepts", selectedPlan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plan_concepts")
        .select("*, payment_concepts(*)")
        .eq("plan_id", selectedPlan!.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPlan?.id,
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const payload = { school_id: schoolId!, name: planForm.name, description: planForm.description };
      if (editingPlan) {
        const { error } = await supabase.from("payment_plans").update(payload).eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans"] });
      setPlanModal(false);
      setEditingPlan(null);
      toast.success(editingPlan ? "Plan actualizado" : "Plan creado");
    },
    onError: () => toast.error("Error al guardar plan"),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans"] });
      toast.success("Plan eliminado");
    },
    onError: () => toast.error("No se puede eliminar, puede tener alumnos asignados"),
  });

  const addConceptToPlan = useMutation({
    mutationFn: async () => {
      const maxOrder = planConcepts.length > 0 ? Math.max(...planConcepts.map((pc: any) => pc.display_order)) + 1 : 0;
      const { error } = await supabase.from("payment_plan_concepts").insert({
        plan_id: selectedPlan!.id,
        concept_id: newPlanConcept.concept_id,
        amount: parseFloat(newPlanConcept.amount) || 0,
        is_mandatory: newPlanConcept.is_mandatory,
        is_recurring: newPlanConcept.is_recurring,
        due_day: newPlanConcept.due_day ? parseInt(newPlanConcept.due_day) : null,
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-concepts"] });
      setAddConceptToPlanModal(false);
      setNewPlanConcept({ concept_id: "", amount: "0", is_mandatory: true, is_recurring: false, due_day: "" });
      toast.success("Concepto asociado al plan");
    },
    onError: () => toast.error("Error al asociar concepto (puede que ya exista)"),
  });

  const removePlanConcept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_plan_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-concepts"] });
      toast.success("Concepto eliminado del plan");
    },
  });

  // ---- EXCHANGE RATES ----
  const { data: rates = [] } = useQuery({
    queryKey: ["exchange-rates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exchange_rates").select("*").eq("school_id", schoolId!);
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const ratesInitialized = Object.keys(rateValues).length > 0;

  const initRates = () => {
    const vals: Record<string, string> = {};
    CURRENCIES.forEach(c => {
      const existing = rates.find((r: any) => r.currency === c.value);
      vals[c.value] = existing ? String(existing.rate_to_ves) : "1";
    });
    setRateValues(vals);
  };

  if (rates.length > 0 && !ratesInitialized) initRates();

  const saveRates = useMutation({
    mutationFn: async () => {
      for (const curr of CURRENCIES) {
        const rate = parseFloat(rateValues[curr.value]) || 1;
        const existing = rates.find((r: any) => r.currency === curr.value);
        if (existing) {
          await supabase.from("exchange_rates").update({ rate_to_ves: rate }).eq("id", existing.id);
        } else {
          await supabase.from("exchange_rates").insert({ school_id: schoolId!, currency: curr.value, rate_to_ves: rate });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      toast.success("Tasas actualizadas");
    },
    onError: () => toast.error("Error al guardar tasas"),
  });

  // ---- DELINQUENCY CONFIG ----
  const { data: delinqConfig } = useQuery({
    queryKey: ["delinquency-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("delinquency_config").select("*").eq("school_id", schoolId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const [delinqForm, setDelinqForm] = useState<any>(null);
  if (delinqConfig && !delinqForm) {
    setDelinqForm({
      overdue_after_day: String(delinqConfig.overdue_after_day),
      reminder_mode: delinqConfig.reminder_mode,
      reminder_days_of_week: delinqConfig.reminder_days_of_week || [],
      reminder_days_of_month: delinqConfig.reminder_days_of_month || [],
    });
  }
  if (!delinqConfig && !delinqForm && schoolId) {
    setDelinqForm({ overdue_after_day: "15", reminder_mode: "never", reminder_days_of_week: [], reminder_days_of_month: [] });
  }

  const saveDelinqConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        school_id: schoolId!,
        overdue_after_day: parseInt(delinqForm.overdue_after_day) || 15,
        reminder_mode: delinqForm.reminder_mode,
        reminder_days_of_week: delinqForm.reminder_days_of_week,
        reminder_days_of_month: delinqForm.reminder_days_of_month,
      };
      if (delinqConfig) {
        const { error } = await supabase.from("delinquency_config").update(payload).eq("id", delinqConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delinquency_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delinquency-config"] });
      toast.success("Configuración de morosidad guardada");
    },
    onError: () => toast.error("Error al guardar configuración"),
  });

  if (schoolLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  const getConceptTypeLabel = (t: string) => CONCEPT_TYPES.find(c => c.value === t)?.label || t;

  return (
    <DashboardLayout>
      <PageHeader title="Configuración de Pagos" breadcrumbs={[{ label: "Ajustes" }, { label: "Pagos" }]} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="concepts"><Package className="h-4 w-4 mr-1" />Conceptos</TabsTrigger>
          <TabsTrigger value="plans"><Settings2 className="h-4 w-4 mr-1" />Planes</TabsTrigger>
          <TabsTrigger value="rates"><DollarSign className="h-4 w-4 mr-1" />Tasas</TabsTrigger>
          <TabsTrigger value="delinquency"><AlertTriangle className="h-4 w-4 mr-1" />Morosidad</TabsTrigger>
        </TabsList>

        {/* CONCEPTS TAB */}
        <TabsContent value="concepts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conceptos de Pago</CardTitle>
                <CardDescription>Catálogo reutilizable de conceptos que puedes asociar a cualquier plan</CardDescription>
              </div>
              <Button onClick={() => openConceptModal()}><Plus className="h-4 w-4 mr-1" />Nuevo Concepto</Button>
            </CardHeader>
            <CardContent>
              {conceptsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Monto por defecto (Bs.)</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concepts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="secondary">{getConceptTypeLabel(c.concept_type)}</Badge></TableCell>
                        <TableCell className="text-right">{Number(c.default_amount).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openConceptModal(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteConcept.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {concepts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay conceptos creados</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANS TAB */}
        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Planes de Pago</CardTitle>
                <CardDescription>Crea planes y asocia conceptos de pago a cada uno</CardDescription>
              </div>
              <Button onClick={() => { setEditingPlan(null); setPlanForm({ name: "", description: "" }); setPlanModal(true); }}><Plus className="h-4 w-4 mr-1" />Nuevo Plan</Button>
            </CardHeader>
            <CardContent>
              {plansLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.description || "—"}</TableCell>
                        <TableCell><Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedPlan(p); setPlanConceptsModal(true); }}>Conceptos</Button>
                          <Button variant="ghost" size="icon" onClick={() => { setEditingPlan(p); setPlanForm({ name: p.name, description: p.description || "" }); setPlanModal(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deletePlan.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {plans.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay planes creados</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXCHANGE RATES TAB */}
        <TabsContent value="rates">
          <Card>
            <CardHeader>
              <CardTitle>Tasas de Cambio</CardTitle>
              <CardDescription>Define el valor de cada moneda de referencia en bolívares (VES)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CURRENCIES.map(c => (
                <div key={c.value} className="flex items-center gap-4">
                  <Label className="w-48 font-medium">{c.label} → VES</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-48"
                    value={rateValues[c.value] || "1"}
                    onChange={e => setRateValues(prev => ({ ...prev, [c.value]: e.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground">Bs. por 1 {c.value}</span>
                </div>
              ))}
              <Button onClick={() => saveRates.mutate()} disabled={saveRates.isPending}>
                {saveRates.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar Tasas
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DELINQUENCY TAB */}
        <TabsContent value="delinquency">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Morosidad</CardTitle>
              <CardDescription>Define cuándo se considera moroso y la frecuencia de recordatorios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {delinqForm && (
                <>
                  <div className="space-y-2">
                    <Label>Día del mes a partir del cual se considera moroso</Label>
                    <Input
                      type="number"
                      min="1"
                      max="28"
                      className="w-32"
                      value={delinqForm.overdue_after_day}
                      onChange={e => setDelinqForm((p: any) => ({ ...p, overdue_after_day: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Modo de recordatorio automático</Label>
                    <RadioGroup
                      value={delinqForm.reminder_mode}
                      onValueChange={v => setDelinqForm((p: any) => ({ ...p, reminder_mode: v }))}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2"><RadioGroupItem value="never" id="rm-never" /><Label htmlFor="rm-never">Nunca</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="daily" id="rm-daily" /><Label htmlFor="rm-daily">Diario</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="weekly" id="rm-weekly" /><Label htmlFor="rm-weekly">Días de la semana</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="monthly" id="rm-monthly" /><Label htmlFor="rm-monthly">Días del mes</Label></div>
                    </RadioGroup>
                  </div>

                  {delinqForm.reminder_mode === "weekly" && (
                    <div className="space-y-2">
                      <Label>Selecciona los días de la semana</Label>
                      <div className="flex flex-wrap gap-3">
                        {WEEK_DAYS.map(d => (
                          <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={(delinqForm.reminder_days_of_week as number[]).includes(d.value)}
                              onCheckedChange={(checked) => {
                                setDelinqForm((p: any) => ({
                                  ...p,
                                  reminder_days_of_week: checked
                                    ? [...(p.reminder_days_of_week as number[]), d.value]
                                    : (p.reminder_days_of_week as number[]).filter((v: number) => v !== d.value),
                                }));
                              }}
                            />
                            <span className="text-sm">{d.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {delinqForm.reminder_mode === "monthly" && (
                    <div className="space-y-2">
                      <Label>Selecciona los días del mes</Label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 5, 10, 15, 20, 25].map(d => (
                          <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={(delinqForm.reminder_days_of_month as number[]).includes(d)}
                              onCheckedChange={(checked) => {
                                setDelinqForm((p: any) => ({
                                  ...p,
                                  reminder_days_of_month: checked
                                    ? [...(p.reminder_days_of_month as number[]), d]
                                    : (p.reminder_days_of_month as number[]).filter((v: number) => v !== d),
                                }));
                              }}
                            />
                            <span className="text-sm">Día {d}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={() => saveDelinqConfig.mutate()} disabled={saveDelinqConfig.isPending}>
                    {saveDelinqConfig.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar Configuración
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CONCEPT MODAL */}
      <Dialog open={conceptModal} onOpenChange={setConceptModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingConcept ? "Editar" : "Nuevo"} Concepto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={conceptForm.name} onChange={e => setConceptForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Descripción</Label><Input value={conceptForm.description} onChange={e => setConceptForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Monto por defecto (Bs.)</Label><Input type="number" step="0.01" value={conceptForm.default_amount} onChange={e => setConceptForm(p => ({ ...p, default_amount: e.target.value }))} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={conceptForm.concept_type} onValueChange={v => setConceptForm(p => ({ ...p, concept_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONCEPT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConceptModal(false)}>Cancelar</Button>
            <Button onClick={() => saveConcept.mutate()} disabled={!conceptForm.name || saveConcept.isPending}>
              {saveConcept.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PLAN MODAL */}
      <Dialog open={planModal} onOpenChange={setPlanModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPlan ? "Editar" : "Nuevo"} Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Descripción</Label><Input value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanModal(false)}>Cancelar</Button>
            <Button onClick={() => savePlan.mutate()} disabled={!planForm.name || savePlan.isPending}>
              {savePlan.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PLAN CONCEPTS MODAL */}
      <Dialog open={planConceptsModal} onOpenChange={setPlanConceptsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Conceptos del plan: {selectedPlan?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" onClick={() => { setNewPlanConcept({ concept_id: "", amount: "0", is_mandatory: true, is_recurring: false, due_day: "" }); setAddConceptToPlanModal(true); }}>
              <Plus className="h-4 w-4 mr-1" />Asociar Concepto
            </Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto (Bs.)</TableHead>
                  <TableHead>Obligatorio</TableHead>
                  <TableHead>Recurrente</TableHead>
                  <TableHead>Día vencimiento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planConcepts.map((pc: any) => (
                  <TableRow key={pc.id}>
                    <TableCell className="font-medium">{pc.payment_concepts?.name}</TableCell>
                    <TableCell><Badge variant="secondary">{getConceptTypeLabel(pc.payment_concepts?.concept_type)}</Badge></TableCell>
                    <TableCell className="text-right">{Number(pc.amount).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{pc.is_mandatory ? "Sí" : "No"}</TableCell>
                    <TableCell>{pc.is_recurring ? "Sí" : "No"}</TableCell>
                    <TableCell>{pc.due_day || "—"}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removePlanConcept.mutate(pc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {planConcepts.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Sin conceptos asociados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD CONCEPT TO PLAN MODAL */}
      <Dialog open={addConceptToPlanModal} onOpenChange={setAddConceptToPlanModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asociar Concepto al Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <Select value={newPlanConcept.concept_id} onValueChange={v => {
                const c = concepts.find((c: any) => c.id === v);
                setNewPlanConcept(p => ({ ...p, concept_id: v, amount: c ? String(c.default_amount) : p.amount }));
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar concepto" /></SelectTrigger>
                <SelectContent>{concepts.filter((c: any) => c.is_active).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Monto en este plan (Bs.)</Label><Input type="number" step="0.01" value={newPlanConcept.amount} onChange={e => setNewPlanConcept(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2"><Checkbox checked={newPlanConcept.is_mandatory} onCheckedChange={v => setNewPlanConcept(p => ({ ...p, is_mandatory: !!v }))} /><span className="text-sm">Obligatorio</span></label>
              <label className="flex items-center gap-2"><Checkbox checked={newPlanConcept.is_recurring} onCheckedChange={v => setNewPlanConcept(p => ({ ...p, is_recurring: !!v }))} /><span className="text-sm">Recurrente</span></label>
            </div>
            <div><Label>Día de vencimiento (opcional)</Label><Input type="number" min="1" max="28" value={newPlanConcept.due_day} onChange={e => setNewPlanConcept(p => ({ ...p, due_day: e.target.value }))} placeholder="Ej: 15" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddConceptToPlanModal(false)}>Cancelar</Button>
            <Button onClick={() => addConceptToPlan.mutate()} disabled={!newPlanConcept.concept_id || addConceptToPlan.isPending}>
              {addConceptToPlan.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Asociar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
