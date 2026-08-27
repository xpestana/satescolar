import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Pencil, RotateCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  clearRateOverride,
  getRateOverride,
  setRateOverride,
  subscribeRateOverrides,
} from "@/lib/exchangeRateOverride";

interface PaymentRateNoticeProps {
  schoolId: string;
  /** Monedas distintas de VES presentes en los conceptos del formulario. */
  currencies: string[];
  /** Tasa que el formulario está usando ahora mismo para esa moneda. */
  getRate: (currency: string) => number;
  /**
   * `create` avisa que se usa la tasa de hoy (hay que ajustarla en pagos con fecha anterior).
   * `edit` avisa que se conserva la tasa con la que se registró el pago.
   */
  mode: "create" | "edit";
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * Aviso visible de la tasa con la que el formulario está convirtiendo los conceptos en moneda
 * extranjera, con opción de corregirla en el sitio.
 *
 * Existe porque la tasa es invisible hasta que descuadra: un concepto de 75 USD vale un monto
 * distinto en bolívares cada día, y registrar o editar un pago con la tasa equivocada produce
 * saldos que no cuadran con lo que la familia realmente pagó.
 */
export function PaymentRateNotice({ schoolId, currencies, getRate, mode }: PaymentRateNoticeProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, string>>({});

  // Redibujar cuando cambia (o expira) un ajuste manual de tasa.
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const unsubscribe = subscribeRateOverrides(bump);
    const interval = window.setInterval(bump, 30_000);
    return () => { unsubscribe(); window.clearInterval(interval); };
  }, []);

  const foreign = currencies.filter((c) => c && c !== "VES");
  if (foreign.length === 0) return null;

  const save = (currency: string, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Tasa inválida", description: "Escriba un número mayor a 0.", variant: "destructive" });
      return;
    }
    setRateOverride(schoolId, currency, parsed);
    setEditing((prev) => { const n = { ...prev }; delete n[currency]; return n; });
    toast({
      title: `Tasa del ${currency} ajustada a ${fmt(parsed)}`,
      description: "El cambio es solo para usted y dura 3 horas. Después se vuelve a usar la tasa del BCV.",
    });
  };

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <div className="flex gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-destructive">
            Los conceptos en divisas se cobran según la tasa del día
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {mode === "create" ? (
              <>
                Las cuotas están fijadas en divisas y se convierten a bolívares con la tasa que aparece
                abajo. <strong>Si está registrando un pago de una fecha anterior</strong>, cambie la tasa
                a la que estaba vigente el día en que la familia pagó, antes de cargar los montos. Si no,
                el recibo no va a coincidir con lo que la familia depositó y al estudiante le va a quedar
                una deuda que en realidad no tiene.
              </>
            ) : (
              <>
                Se está usando la misma tasa con la que se registró este pago, para no alterar los montos
                ya cobrados. <strong>Si solo va a corregir datos de la factura</strong> (nombre, cédula,
                número), deje la tasa como está y los saldos no se van a mover. Cámbiela únicamente si
                necesita recalcular lo que la familia pagó.
              </>
            )}
          </p>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {foreign.map((cur) => {
              const override = getRateOverride(schoolId, cur);
              const isEditing = cur in editing;
              return (
                <div
                  key={cur}
                  className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs"
                >
                  <span className="font-medium whitespace-nowrap">1,00 {cur} =</span>
                  {isEditing ? (
                    <>
                      <Input
                        type="number"
                        step="0.0001"
                        autoFocus
                        className="h-6 w-24 text-xs"
                        value={editing[cur]}
                        onChange={(e) => setEditing((p) => ({ ...p, [cur]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(cur, editing[cur]);
                          if (e.key === "Escape") setEditing((p) => { const n = { ...p }; delete n[cur]; return n; });
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Aplicar" onClick={() => save(cur, editing[cur])}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Cancelar"
                        onClick={() => setEditing((p) => { const n = { ...p }; delete n[cur]; return n; })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold whitespace-nowrap">{fmt(getRate(cur))} Bs</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Cambiar la tasa"
                        onClick={() => setEditing((p) => ({ ...p, [cur]: String(getRate(cur) || "") }))}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {override && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Volver a la tasa del BCV"
                          onClick={() => {
                            clearRateOverride(schoolId, cur);
                            toast({ title: `Tasa del ${cur} restaurada`, description: "Se vuelve a usar la tasa del BCV." });
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                  {override && !isEditing && (
                    <span className="text-[10px] text-destructive whitespace-nowrap">tasa ajustada a mano</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
