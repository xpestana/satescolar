import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { EMPTY_FILTERS, type PaymentsReportFilters as Filters } from "@/lib/paymentsReport";

/** Valor de los `Select` cuando no hay filtro (Radix no admite `value=""`). */
const ANY = "__all__";

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  plans: { id: string; name: string }[];
  methods: { id: string; label: string }[];
  conceptTypes: string[];
  currencies: string[];
  activeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Filtros del Reporte de Pagos: búsqueda siempre visible + panel avanzado plegable. */
export function PaymentsReportFilters({
  filters, onChange, plans, methods, conceptTypes, currencies, activeCount, open, onOpenChange,
}: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const selectValue = (value: string) => (value === "" ? ANY : value);
  const fromSelect = (value: string) => (value === ANY ? "" : value);

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar factura, control, estudiante, familia, referencia, concepto..."
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros avanzados
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </Button>
        </CollapsibleTrigger>
        {activeCount > 0 && (
          <Button variant="ghost" className="gap-1" onClick={() => onChange(EMPTY_FILTERS)}>
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={filters.status} onValueChange={(v) => set("status", v as Filters["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="voided">Anulados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de línea</Label>
            <Select value={filters.kind} onValueChange={(v) => set("kind", v as Filters["kind"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="cuota">Cuotas</SelectItem>
                <SelectItem value="otros">Otros ingresos</SelectItem>
                <SelectItem value="exoneracion">Exoneraciones</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plan</Label>
            <Select value={selectValue(filters.planId)} onValueChange={(v) => set("planId", fromSelect(v))}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de concepto</Label>
            <Select value={selectValue(filters.conceptType)} onValueChange={(v) => set("conceptType", fromSelect(v))}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {conceptTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Método de pago</Label>
            <Select value={selectValue(filters.methodId)} onValueChange={(v) => set("methodId", fromSelect(v))}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Moneda del concepto</Label>
            <Select value={selectValue(filters.conceptCurrency)} onValueChange={(v) => set("conceptCurrency", fromSelect(v))}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto desde (VES)</Label>
            <Input type="number" step="0.01" value={filters.minAmount} onChange={(e) => set("minAmount", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto hasta (VES)</Label>
            <Input type="number" step="0.01" value={filters.maxAmount} onChange={(e) => set("maxAmount", e.target.value)} />
          </div>
          <div className="flex flex-col justify-end gap-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={filters.onlyDiscounts} onCheckedChange={(v) => set("onlyDiscounts", Boolean(v))} />
              Solo líneas con descuento
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={filters.onlyExonerations} onCheckedChange={(v) => set("onlyExonerations", Boolean(v))} />
              Solo cuotas exoneradas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={filters.onlyPartial} onCheckedChange={(v) => set("onlyPartial", Boolean(v))} />
              Solo abonos parciales
            </label>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
