import { useState, useEffect } from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ExchangeRateWidgetProps {
  schoolId: string;
  rates: Record<string, number>;
  onRatesChange: (rates: Record<string, number>) => void;
}

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "EUR", symbol: "€", label: "EUR" },
  { code: "COP", symbol: "$", label: "COP" },
];

export function ExchangeRateWidget({ schoolId, rates, onRatesChange }: ExchangeRateWidgetProps) {
  const queryClient = useQueryClient();
  const [localRates, setLocalRates] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const r: Record<string, string> = {};
    CURRENCIES.forEach(c => { r[c.code] = String(rates[c.code] || 1); });
    setLocalRates(r);
  }, [rates]);

  const saveRate = useMutation({
    mutationFn: async (currency: string) => {
      const rate = parseFloat(localRates[currency]) || 1;
      const { data: existing } = await supabase
        .from("exchange_rates")
        .select("id")
        .eq("school_id", schoolId)
        .eq("currency", currency)
        .maybeSingle();

      if (existing) {
        await supabase.from("exchange_rates").update({ rate_to_ves: rate }).eq("id", existing.id);
      } else {
        await supabase.from("exchange_rates").insert({ school_id: schoolId, currency, rate_to_ves: rate });
      }
      onRatesChange({ ...rates, [currency]: rate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  return (
    <div className="fixed bottom-4 right-4 z-30">
      {expanded ? (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Tasas de Cambio</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="text-xs">Cerrar</Button>
          </div>
          {CURRENCIES.map(c => (
            <div key={c.code} className="flex items-center gap-2">
              <span className="text-xs font-medium w-10">{c.label}</span>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-sm"
                value={localRates[c.code] || "1"}
                onChange={e => setLocalRates(p => ({ ...p, [c.code]: e.target.value }))}
                onBlur={() => saveRate.mutate(c.code)}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Bs.</span>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Las tasas se guardan automáticamente al salir del campo</p>
        </div>
      ) : (
        <Button
          onClick={() => setExpanded(true)}
          className="rounded-full h-12 w-12 shadow-lg"
          size="icon"
          title="Tasas de cambio"
        >
          <DollarSign className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
