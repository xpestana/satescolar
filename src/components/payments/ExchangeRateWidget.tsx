import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, DollarSign, Euro, Loader2, ChevronUp, ChevronDown, RotateCcw, Clock } from "lucide-react";
import { ensureFreshBcvRates } from "@/lib/ensureFreshBcvRates";
import {
  applyRateOverride,
  clearRateOverride,
  getRateOverride,
  setRateOverride,
  subscribeRateOverrides,
} from "@/lib/exchangeRateOverride";

interface ExchangeRateWidgetProps {
  schoolId: string;
  floating?: boolean;
}

export function ExchangeRateWidget({ schoolId, floating = true }: ExchangeRateWidgetProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("exchange-widget-collapsed") === "true"; } catch { return false; }
  });

  // Re-render when a personal override changes or its countdown ticks.
  const [, setOverrideTick] = useState(0);
  useEffect(() => {
    const bump = () => setOverrideTick((n) => n + 1);
    const unsubscribe = subscribeRateOverrides(bump);
    const interval = window.setInterval(bump, 30_000);
    return () => { unsubscribe(); window.clearInterval(interval); };
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("exchange-widget-collapsed", String(next)); } catch { /* ignore */ }
  };

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

  // Force a fresh pull from the BCV edge function (ignores the "already today" gate).
  const forceFetchBcv = async () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch(`${baseUrl}/functions/v1/fetch-bcv-rates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Error al obtener tasas BCV");
    return json.data as { usd: number; eur: number; published_date: string };
  };

  // BCV refresh. `force` (button) always re-fetches; otherwise (mount) only if the DB date is stale.
  const fetchBcv = useMutation({
    mutationFn: async (opts?: { force?: boolean }) => {
      if (opts?.force) {
        const data = await forceFetchBcv();
        return { updated: true, publishedDate: data.published_date };
      }
      return ensureFreshBcvRates();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["exchange-rates", schoolId] });
      qc.invalidateQueries({ queryKey: ["bcv-latest"] });
      if (result.updated) {
        toast({ title: "Tasas BCV actualizadas", description: result.publishedDate ? `Fecha valor: ${result.publishedDate}` : undefined });
      }
    },
    onError: (e: any) => toast({ title: "Error BCV", description: e.message, variant: "destructive" }),
  });

  // Auto-refresh once per mount (only fetches remotely if the DB date is stale).
  useEffect(() => {
    fetchBcv.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const currencies = [
    { code: "USD", label: "Dólar", icon: DollarSign, color: "text-green-600" },
    { code: "EUR", label: "Euro", icon: Euro, color: "text-blue-600" },
    { code: "COP", label: "Peso COP", icon: DollarSign, color: "text-yellow-600" },
  ];

  const getDbRate = (currency: string) => rates.find((r) => r.currency === currency)?.rate_to_ves || 0;
  const getRate = (currency: string) => applyRateOverride(schoolId, currency, getDbRate(currency));

  const saveOverride = (currency: string, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Tasa inválida", variant: "destructive" });
      return;
    }
    setRateOverride(schoolId, currency, parsed);
    setEditing((prev) => { const n = { ...prev }; delete n[currency]; return n; });
    toast({ title: `Tasa ${currency} ajustada`, description: "Solo para ti, por 3 horas. Luego vuelve a la tasa BCV." });
  };

  const restoreRate = (currency: string) => {
    clearRateOverride(schoolId, currency);
    toast({ title: `Tasa ${currency} restaurada`, description: "Se usa de nuevo la tasa BCV actual." });
  };

  const formatRemaining = (expiresAt: number) => {
    const ms = expiresAt - Date.now();
    if (ms <= 0) return "";
    const totalMin = Math.ceil(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const wrapperClass = floating
    ? "fixed bottom-4 left-4 z-50 w-64 bg-background border border-border rounded-xl shadow-lg overflow-hidden"
    : "bg-background border border-border rounded-xl overflow-hidden";

  return (
    <div className={wrapperClass}>
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none hover:bg-muted/40 transition-colors"
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir tasas de cambio" : "Minimizar tasas de cambio"}
      >
        <h4 className="text-sm font-bold text-foreground">Tasas de Cambio</h4>
        <div className="flex items-center gap-1">
          {(isLoading || fetchBcv.isPending) && <Loader2 className="animate-spin h-3 w-3 text-muted-foreground" />}
          {collapsed
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {bcvInfo && (
            <p className="text-[10px] text-muted-foreground -mt-1">
              BCV: {new Date(bcvInfo.published_date + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}

          {currencies.map(({ code, icon: Icon, color }) => {
            const rate = getRate(code);
            const isEditing = code in editing;
            const override = getRateOverride(schoolId, code);
            return (
              <div key={code} className="space-y-0.5">
                <div className="flex items-center gap-2">
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
                          if (e.key === "Enter") saveOverride(code, editing[code]);
                          if (e.key === "Escape") setEditing((prev) => { const n = { ...prev }; delete n[code]; return n; });
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveOverride(code, editing[code])}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`text-xs flex-1 font-mono cursor-pointer hover:text-primary ${override ? "text-primary font-semibold" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setEditing({ ...editing, [code]: rate.toString() }); }}
                        title="Click para ajustar (solo para ti, 3h)"
                      >
                        {rate > 0 ? rate.toLocaleString("es-VE", { minimumFractionDigits: 2 }) : "Sin tasa"}
                      </span>
                      {override ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); restoreRate(code); }}
                          title="Restaurar tasa BCV"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">VES</span>
                      )}
                    </>
                  )}
                </div>
                {override && !isEditing && (
                  <div className="flex items-center gap-1 pl-16 text-[9px] text-primary/80">
                    <Clock className="h-2.5 w-2.5" />
                    <span>Tuya · {formatRemaining(override.expiresAt)}</span>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1 gap-2">
            <p className="text-[10px] text-muted-foreground">Click en la tasa para ajustar</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={(e) => { e.stopPropagation(); fetchBcv.mutate({ force: true }); }}
              disabled={fetchBcv.isPending}
              title="Traer la tasa BCV publicada hoy"
            >
              {fetchBcv.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
              Actualizar hoy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
