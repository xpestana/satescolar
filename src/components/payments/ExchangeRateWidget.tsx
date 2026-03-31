import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, Euro, Loader2, Download } from "lucide-react";

interface ExchangeRateWidgetProps {
  schoolId: string;
  floating?: boolean;
}

export function ExchangeRateWidget({ schoolId, floating = true }: ExchangeRateWidgetProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["exchange-rates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exchange_rates").select("*").eq("school_id", schoolId).order("currency");
      if (error) throw error;
      return data;
    },
  });

  // Latest BCV rate date
  const { data: bcvInfo } = useQuery({
    queryKey: ["bcv-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bcv_rates")
        .select("published_date, fetched_at")
        .eq("currency", "USD")
        .order("published_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const updateRate = useMutation({
    mutationFn: async ({ currency, rate }: { currency: string; rate: number }) => {
      const existing = rates.find((r) => r.currency === currency);
      if (existing) {
        const { error } = await supabase.from("exchange_rates").update({ rate_to_ves: rate, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exchange_rates").insert({ school_id: schoolId, currency, rate_to_ves: rate });
        if (error) throw error;
      }
    },
    onSuccess: (_, { currency }) => {
      qc.invalidateQueries({ queryKey: ["exchange-rates", schoolId] });
      toast({ title: `Tasa ${currency} actualizada` });
      setEditing((prev) => { const n = { ...prev }; delete n[currency]; return n; });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fetchBcv = useMutation({
    mutationFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-bcv-rates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al obtener tasas BCV");
      return json.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["exchange-rates", schoolId] });
      qc.invalidateQueries({ queryKey: ["bcv-latest"] });
      toast({ title: "Tasas BCV actualizadas", description: `USD: ${data.usd} | EUR: ${data.eur} (${data.published_date})` });
    },
    onError: (e: any) => toast({ title: "Error BCV", description: e.message, variant: "destructive" }),
  });

  const currencies = [
    { code: "USD", label: "Dólar", icon: DollarSign, color: "text-green-600" },
    { code: "EUR", label: "Euro", icon: Euro, color: "text-blue-600" },
    { code: "COP", label: "Peso COP", icon: DollarSign, color: "text-yellow-600" },
  ];

  const getRate = (currency: string) => rates.find((r) => r.currency === currency)?.rate_to_ves || 0;

  const wrapperClass = floating
    ? "fixed bottom-4 left-4 z-50 w-72 bg-background border border-border rounded-xl shadow-lg p-4 space-y-3"
    : "bg-background border border-border rounded-xl p-4 space-y-3";

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">Tasas de Cambio</h4>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => fetchBcv.mutate()}
            disabled={fetchBcv.isPending}
            title="Descargar tasa BCV"
          >
            {fetchBcv.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : <Download className="h-3 w-3" />}
          </Button>
          {isLoading && <Loader2 className="animate-spin h-3 w-3" />}
        </div>
      </div>

      {bcvInfo && (
        <p className="text-[10px] text-muted-foreground">
          BCV: {new Date(bcvInfo.published_date + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      )}

      {currencies.map(({ code, label, icon: Icon, color }) => {
        const rate = getRate(code);
        const isEditing = code in editing;
        return (
          <div key={code} className="flex items-center gap-2">
            <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
            <span className="text-xs font-medium w-10">{code}</span>
            {isEditing ? (
              <>
                <Input
                  type="number"
                  step="0.01"
                  className="h-7 text-xs flex-1"
                  value={editing[code]}
                  onChange={(e) => setEditing({ ...editing, [code]: e.target.value })}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateRate.mutate({ currency: code, rate: parseFloat(editing[code]) || 0 });
                    if (e.key === "Escape") setEditing((prev) => { const n = { ...prev }; delete n[code]; return n; });
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateRate.mutate({ currency: code, rate: parseFloat(editing[code]) || 0 })} disabled={updateRate.isPending}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs flex-1 font-mono cursor-pointer hover:text-primary" onClick={() => setEditing({ ...editing, [code]: rate.toString() })}>
                  {rate > 0 ? rate.toLocaleString("es-VE", { minimumFractionDigits: 2 }) : "Sin tasa"}
                </span>
                <span className="text-[10px] text-muted-foreground">VES</span>
              </>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground">Click en la tasa para editar · <Download className="inline h-2.5 w-2.5" /> para BCV</p>
    </div>
  );
}
