import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { SchoolYearOption } from "@/hooks/useSchoolYearSelection";
import { friendlyPaymentConfigError } from "@/lib/paymentConfigErrors";

interface SourcePlan {
  id: string;
  name: string;
  is_active: boolean;
  payment_plan_concepts: { id: string }[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  years: SchoolYearOption[];
  targetYear: SchoolYearOption;
  /** Nombres de los planes que ya existen en el año destino (no se duplican). */
  existingNames: string[];
}

const normalizeName = (s: string) => s.trim().toLowerCase();

/**
 * Copia planes (con sus cuotas: monto, moneda, descuento y vencimiento) de otro año al año elegido,
 * vía el RPC `copy_payment_plans_to_year`. Después se ajustan los montos del año nuevo sin tocar el
 * año de origen, porque cada copia es un plan independiente.
 */
export function CopyPaymentPlansDialog({ open, onOpenChange, schoolId, years, targetYear, existingNames }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const sourceYears = useMemo(() => years.filter((y) => y.id !== targetYear.id), [years, targetYear.id]);
  const [fromYearId, setFromYearId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setFromYearId((prev) => (prev && sourceYears.some((y) => y.id === prev) ? prev : sourceYears[0]?.id ?? ""));
  }, [open, sourceYears]);

  const existing = useMemo(() => new Set(existingNames.map(normalizeName)), [existingNames]);

  const { data: sourcePlans = [], isLoading } = useQuery({
    queryKey: ["copy-plans-source", schoolId, fromYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plans")
        .select("id, name, is_active, payment_plan_concepts(id)")
        .eq("school_id", schoolId)
        .eq("school_year_id", fromYearId)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as SourcePlan[];
    },
    enabled: open && !!fromYearId,
  });

  // Por defecto se marcan todos los que todavía no existen en el año destino
  useEffect(() => {
    setSelected(new Set(sourcePlans.filter((p) => !existing.has(normalizeName(p.name))).map((p) => p.id)));
  }, [sourcePlans, existing]);

  const fromYear = sourceYears.find((y) => y.id === fromYearId);

  const copy = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("copy_payment_plans_to_year", {
        _school_id: schoolId,
        _from_year_id: fromYearId,
        _to_year_id: targetYear.id,
        _plan_ids: [...selected],
      });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
    onSuccess: (copied) => {
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
      qc.invalidateQueries({ queryKey: ["available-plans"] });
      qc.invalidateQueries({ queryKey: ["payments-report-plans"] });
      toast({
        title: `Se copiaron ${copied} plan${copied === 1 ? "" : "es"} a ${targetYear.year_range}`,
        description: `Ajuste los montos y la moneda de ${targetYear.year_range}: ${fromYear?.year_range ?? "el año de origen"} no cambia.`,
      });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast({ title: "No se pudieron copiar los planes", description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Copiar planes a {targetYear.year_range}</DialogTitle>
          <DialogDescription>
            Se duplican los planes con sus cuotas (monto, moneda, descuento y vencimiento). Luego puede cambiar
            los montos de {targetYear.year_range} sin afectar al año de origen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Copiar desde</Label>
            <Select value={fromYearId} onValueChange={setFromYearId}>
              <SelectTrigger><SelectValue placeholder="Seleccione un año" /></SelectTrigger>
              <SelectContent>
                {sourceYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.year_range}{y.is_active ? " (activo)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : sourcePlans.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">No hay planes en ese año.</p>
            ) : (
              sourcePlans.map((p) => {
                const alreadyThere = existing.has(normalizeName(p.name));
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${alreadyThere ? "opacity-60" : "cursor-pointer"}`}>
                    <Checkbox
                      checked={selected.has(p.id)}
                      disabled={alreadyThere}
                      onCheckedChange={(v) => toggle(p.id, !!v)}
                    />
                    <span className="font-medium flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.payment_plan_concepts?.length ?? 0} cuotas</span>
                    {alreadyThere && <Badge variant="secondary" className="text-[10px]">Ya existe</Badge>}
                    {!p.is_active && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => copy.mutate()} disabled={selected.size === 0 || copy.isPending}>
            {copy.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
            Copiar {selected.size} plan{selected.size === 1 ? "" : "es"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
