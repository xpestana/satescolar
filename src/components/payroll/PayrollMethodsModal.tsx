import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollMethods } from "@/hooks/payroll/usePayrollMethods";
import { METHOD_LABELS, type PayrollMethodType } from "@/lib/payroll/types";

interface PayrollMethodsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  beneficiaryId: string;
  beneficiaryName: string;
}

const METHOD_ORDER: PayrollMethodType[] = ["transfer", "mobile_payment", "cash", "check"];

// Which config fields each method type collects.
const FIELDS: Record<PayrollMethodType, { key: string; label: string }[]> = {
  transfer: [
    { key: "bank_name", label: "Banco" },
    { key: "account_number", label: "N° de cuenta" },
    { key: "account_holder", label: "Titular" },
  ],
  mobile_payment: [
    { key: "bank_name", label: "Banco" },
    { key: "phone", label: "Teléfono" },
    { key: "document_id", label: "Cédula/RIF" },
  ],
  cash: [],
  check: [{ key: "bank_name", label: "Banco" }],
};

export function PayrollMethodsModal({
  open,
  onOpenChange,
  schoolId,
  beneficiaryId,
  beneficiaryName,
}: PayrollMethodsModalProps) {
  const { toast } = useToast();
  const { methods, saveMethod, deleteMethod } = usePayrollMethods(schoolId, beneficiaryId);

  const [methodType, setMethodType] = useState<PayrollMethodType>("transfer");
  const [label, setLabel] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isDefault, setIsDefault] = useState(false);

  const reset = () => {
    setMethodType("transfer");
    setLabel("");
    setConfig({});
    setIsDefault(false);
  };

  const handleAdd = () => {
    saveMethod.mutate(
      { method_type: methodType, label: label.trim() || null, config, is_default: isDefault },
      {
        onSuccess: () => {
          toast({ title: "Método guardado" });
          reset();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const describe = (cfg: Record<string, unknown>) =>
    Object.entries(cfg)
      .filter(([, v]) => v)
      .map(([, v]) => String(v))
      .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Métodos de pago — {beneficiaryName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Existing methods */}
          <div className="space-y-2">
            {methods.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay métodos guardados aún.</p>
            )}
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label || METHOD_LABELS[m.method_type]}</span>
                    <Badge variant="outline" className="text-xs">{METHOD_LABELS[m.method_type]}</Badge>
                    {m.is_default && (
                      <Badge className="text-xs gap-1"><Star className="h-3 w-3" />Predeterminado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{describe(m.config) || "—"}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    deleteMethod.mutate(m.id, {
                      onSuccess: () => toast({ title: "Método eliminado" }),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <p className="text-sm font-medium">Agregar método</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={methodType} onValueChange={(v) => { setMethodType(v as PayrollMethodType); setConfig({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_ORDER.map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etiqueta (opcional)</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Banesco principal" />
              </div>
            </div>
            {FIELDS[methodType].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={config[f.key] ?? ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Checkbox id="is-default" checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
              <Label htmlFor="is-default" className="text-sm font-normal">Marcar como predeterminado</Label>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saveMethod.isPending}>
              {saveMethod.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Agregar método
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
