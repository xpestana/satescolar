import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface PaymentMethodData {
  id: string;
  method: string;
  bank_name: string;
  reference_code: string;
  amount_original: string;
  currency: string;
  exchange_rate: string;
  payment_date: string;
  details: string;
}

interface PaymentMethodRowProps {
  data: PaymentMethodData;
  rates: Record<string, number>;
  onChange: (data: PaymentMethodData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const METHODS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "pago_movil", label: "Pago Móvil" },
  { value: "zelle", label: "Zelle" },
  { value: "punto_venta", label: "Punto de Venta" },
];

export function PaymentMethodRow({ data, rates, onChange, onRemove, canRemove }: PaymentMethodRowProps) {
  const amountVes = (() => {
    const orig = parseFloat(data.amount_original) || 0;
    if (data.currency === "VES") return orig;
    const rate = parseFloat(data.exchange_rate) || rates[data.currency] || 1;
    return orig * rate;
  })();

  const handleCurrencyChange = (currency: string) => {
    const rate = currency === "VES" ? "1" : String(rates[currency] || 1);
    onChange({ ...data, currency, exchange_rate: rate });
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium">Método</label>
          <Select value={data.method} onValueChange={v => onChange({ ...data, method: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium">Banco</label>
          <Input className="h-8" value={data.bank_name} onChange={e => onChange({ ...data, bank_name: e.target.value })} placeholder="Nombre del banco" />
        </div>
        <div>
          <label className="text-xs font-medium">Referencia</label>
          <Input className="h-8" value={data.reference_code} onChange={e => onChange({ ...data, reference_code: e.target.value })} placeholder="Código" />
        </div>
        <div>
          <label className="text-xs font-medium">Fecha</label>
          <Input type="date" className="h-8" value={data.payment_date} onChange={e => onChange({ ...data, payment_date: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="text-xs font-medium">Monto</label>
          <Input type="number" step="0.01" className="h-8" value={data.amount_original} onChange={e => onChange({ ...data, amount_original: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium">Moneda</label>
          <Select value={data.currency} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="VES">VES (Bs.)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="COP">COP ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {data.currency !== "VES" && (
          <div>
            <label className="text-xs font-medium">Tasa usada</label>
            <Input type="number" step="0.01" className="h-8" value={data.exchange_rate} onChange={e => onChange({ ...data, exchange_rate: e.target.value })} />
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium">Equivalente Bs.</label>
            <div className="h-8 flex items-center text-sm font-semibold text-primary">
              Bs. {amountVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </div>
          </div>
          {canRemove && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function getAmountVes(data: PaymentMethodData, rates: Record<string, number>): number {
  const orig = parseFloat(data.amount_original) || 0;
  if (data.currency === "VES") return orig;
  const rate = parseFloat(data.exchange_rate) || rates[data.currency] || 1;
  return orig * rate;
}
