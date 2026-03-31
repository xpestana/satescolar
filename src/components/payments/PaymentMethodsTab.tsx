import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, CreditCard, Building2, Phone, Mail, Banknote, Check, ChevronsUpDown } from "lucide-react";
import { VENEZUELAN_BANKS, METHOD_TYPE_LABELS, METHOD_TYPES } from "@/lib/venezuelan-banks";
import { cn } from "@/lib/utils";

function BankCombobox({ value, onChange }: { value: string; onChange: (code: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = VENEZUELAN_BANKS.find((b) => b.codigo === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-8 w-full justify-between text-xs font-normal">
          {selected ? `${selected.codigo} - ${selected.nombre}` : "Seleccione banco"}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar banco..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No se encontró banco.</CommandEmpty>
            <CommandGroup>
              {VENEZUELAN_BANKS.map((b) => (
                <CommandItem key={b.codigo} value={`${b.codigo} ${b.nombre}`} onSelect={() => { onChange(b.codigo, b.nombre); setOpen(false); }}>
                  <Check className={cn("mr-2 h-3 w-3", value === b.codigo ? "opacity-100" : "opacity-0")} />
                  <span className="text-xs">{b.codigo} - {b.nombre}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  transferencia: <Building2 className="h-4 w-4" />,
  pago_movil: <Phone className="h-4 w-4" />,
  zelle: <Mail className="h-4 w-4" />,
  efectivo: <Banknote className="h-4 w-4" />,
  punto_venta: <CreditCard className="h-4 w-4" />,
  tarjeta_debito: <CreditCard className="h-4 w-4" />,
  tarjeta_credito: <CreditCard className="h-4 w-4" />,
};

const CURRENCY_OPTIONS = [
  { value: "VES", label: "Bolívares (VES)" },
  { value: "USD", label: "Dólares (USD)" },
  { value: "EUR", label: "Euros (EUR)" },
  { value: "COP", label: "Pesos Colombianos (COP)" },
];

interface MethodForm {
  method_type: string;
  label: string;
  is_active: boolean;
  config: Record<string, any>;
}

const emptyForm = (): MethodForm => ({
  method_type: "transferencia",
  label: "",
  is_active: true,
  config: {},
});

function MethodConfigFields({ methodType, config, onChange }: { methodType: string; config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });

  switch (methodType) {
    case "transferencia":
      return (
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Banco *</Label>
            <Select value={config.bank_code || ""} onValueChange={(v) => {
              const bank = VENEZUELAN_BANKS.find((b) => b.codigo === v);
              onChange({ ...config, bank_code: v, bank_name: bank?.nombre || "" });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccione banco" /></SelectTrigger>
              <SelectContent>
                {VENEZUELAN_BANKS.map((b) => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} - {b.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Número de Cuenta (20 dígitos) *</Label>
              <Input className="h-8 text-xs" maxLength={20} value={config.account_number || ""} onChange={(e) => set("account_number", e.target.value.replace(/\D/g, "").slice(0, 20))} placeholder="01020000000000000000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Cuenta *</Label>
              <Select value={config.account_type || ""} onValueChange={(v) => set("account_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corriente">Corriente</SelectItem>
                  <SelectItem value="ahorro">Ahorro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">A Nombre de *</Label><Input className="h-8 text-xs" value={config.account_holder || ""} onChange={(e) => set("account_holder", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Cédula / RIF *</Label><Input className="h-8 text-xs" value={config.document_id || ""} onChange={(e) => set("document_id", e.target.value)} /></div>
          </div>
        </div>
      );

    case "pago_movil":
      return (
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Banco *</Label>
            <Select value={config.bank_code || ""} onValueChange={(v) => {
              const bank = VENEZUELAN_BANKS.find((b) => b.codigo === v);
              onChange({ ...config, bank_code: v, bank_name: bank?.nombre || "" });
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccione banco" /></SelectTrigger>
              <SelectContent>
                {VENEZUELAN_BANKS.map((b) => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} - {b.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Teléfono *</Label><Input className="h-8 text-xs" value={config.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="04XX-XXXXXXX" /></div>
            <div className="space-y-1"><Label className="text-xs">Cédula / RIF *</Label><Input className="h-8 text-xs" value={config.document_id || ""} onChange={(e) => set("document_id", e.target.value)} /></div>
          </div>
        </div>
      );

    case "zelle":
      return (
        <div className="space-y-1">
          <Label className="text-xs">Correo Zelle *</Label>
          <Input className="h-8 text-xs" type="email" value={config.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
      );

    case "efectivo":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Monedas aceptadas *</Label>
          <div className="flex flex-wrap gap-4">
            {CURRENCY_OPTIONS.map((cur) => (
              <div key={cur.value} className="flex items-center gap-2">
                <Checkbox
                  checked={(config.currencies || []).includes(cur.value)}
                  onCheckedChange={(checked) => {
                    const currencies = config.currencies || [];
                    set("currencies", checked ? [...currencies, cur.value] : currencies.filter((c: string) => c !== cur.value));
                  }}
                />
                <Label className="text-xs">{cur.label}</Label>
              </div>
            ))}
          </div>
        </div>
      );

    case "punto_venta":
    case "tarjeta_debito":
    case "tarjeta_credito":
      return (
        <div className="space-y-1">
          <Label className="text-xs">Banco (opcional)</Label>
          <Select value={config.bank_code || ""} onValueChange={(v) => {
            const bank = VENEZUELAN_BANKS.find((b) => b.codigo === v);
            onChange({ ...config, bank_code: v, bank_name: bank?.nombre || "" });
          }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccione banco" /></SelectTrigger>
            <SelectContent>
              {VENEZUELAN_BANKS.map((b) => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} - {b.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}

function formatMethodSummary(methodType: string, config: Record<string, any>): string {
  switch (methodType) {
    case "transferencia":
      return [config.bank_name, config.account_number ? `Cuenta: ...${config.account_number?.slice(-4)}` : "", config.account_holder].filter(Boolean).join(" · ");
    case "pago_movil":
      return [config.bank_name, config.phone, config.document_id].filter(Boolean).join(" · ");
    case "zelle":
      return config.email || "";
    case "efectivo":
      return (config.currencies || []).join(", ");
    case "punto_venta":
    case "tarjeta_debito":
    case "tarjeta_credito":
      return config.bank_name || "Sin banco especificado";
    default:
      return "";
  }
}

export function PaymentMethodsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MethodForm>(emptyForm());

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["school-payment-methods", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_payment_methods").select("*").eq("school_id", schoolId).order("display_order").order("method_type");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.label.trim()) throw new Error("Nombre/etiqueta es requerido");
      const payload = {
        school_id: schoolId,
        method_type: form.method_type,
        label: form.label.trim(),
        config: form.config,
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from("school_payment_methods").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_payment_methods").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-payment-methods"] });
      toast({ title: editId ? "Método actualizado" : "Método registrado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-payment-methods"] });
      toast({ title: "Método eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm()); };
  const openEdit = (m: any) => {
    setEditId(m.id);
    setForm({ method_type: m.method_type, label: m.label, is_active: m.is_active, config: (m.config as Record<string, any>) || {} });
    setOpen(true);
  };

  // Group methods by type
  const grouped = METHOD_TYPES.reduce<Record<string, any[]>>((acc, type) => {
    const items = methods.filter((m: any) => m.method_type === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Métodos de Pago Aceptados por el Colegio</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Agregar Método</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No hay métodos de pago registrados. Agregue los métodos que el colegio acepta.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  {METHOD_ICONS[type]}
                  <h3 className="font-semibold text-sm">{METHOD_TYPE_LABELS[type]}</h3>
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2 ml-6">
                  {items.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{m.label}</span>
                          {!m.is_active && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{formatMethodSummary(m.method_type, (m.config as Record<string, any>) || {})}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(m.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Método de Pago" : "Agregar Método de Pago"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label>Tipo de Método *</Label>
              <Select value={form.method_type} onValueChange={(v) => setForm({ ...form, method_type: v, config: {} })} disabled={!!editId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_TYPES.map((t) => <SelectItem key={t} value={t}>{METHOD_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre / Etiqueta *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder='Ej: "Banesco Corriente", "Zelle principal"' />
            </div>

            <div className="border rounded-lg p-3 bg-muted/30">
              <MethodConfigFields methodType={form.method_type} config={form.config} onChange={(c) => setForm({ ...form, config: c })} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
