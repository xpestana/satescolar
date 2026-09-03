import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ConceptExoneration {
  id: string;
  school_id: string;
  school_year_id: string;
  student_id: string;
  balance_id: string;
  plan_concept_id: string;
  amount_ves: number;
  original_amount: number | null;
  currency: string;
  exchange_rate: number;
  reason: string;
  created_by: string | null;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
}

/** Fila de `student_concept_balances` con lo mínimo para exonerar y revertir. */
export interface ExonerableBalance {
  id: string;
  school_id: string;
  school_year_id: string;
  student_id: string;
  plan_concept_id: string;
  currency?: string | null;
  exchange_rate_snapshot?: number | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  balance?: number | null;
}

/** Claves de query que dependen de saldos/exoneraciones y deben refrescarse tras exonerar. */
const AFFECTED_QUERY_KEYS = [
  "concept-exonerations",
  "student-balances-ledger",
  "family-balances-ledger",
  "student-balances",
  "family-students-balances",
  "all-student-balances",
  "all-balances-dashboard",
  "all-exonerations-dashboard",
];

/**
 * Exoneraciones de cuotas (el colegio perdona el pendiente completo de un concepto).
 * A diferencia del descuento ad-hoc, no van dentro de un pago: se aplican desde el estado
 * de cuenta y cierran el saldo sin generar ingreso.
 */
export function useConceptExonerations(params: {
  schoolId?: string | null;
  schoolYearId?: string | null;
  studentIds?: string[];
}) {
  const { schoolId, schoolYearId, studentIds = [] } = params;
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const idsKey = [...studentIds].sort().join(",");

  const exonerationsQuery = useQuery({
    queryKey: ["concept-exonerations", schoolId, schoolYearId, idsKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concept_exonerations")
        .select("*")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!)
        .in("student_id", studentIds)
        .is("reverted_at", null);
      if (error) throw error;
      return (data || []) as ConceptExoneration[];
    },
    enabled: !!schoolId && !!schoolYearId && studentIds.length > 0,
  });

  const byBalanceId: Record<string, ConceptExoneration> = {};
  (exonerationsQuery.data || []).forEach((e) => { byBalanceId[e.balance_id] = e; });

  const invalidate = () => AFFECTED_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));

  /** Exonera el pendiente completo de una cuota: saldo a 0 y estado "exonerated". */
  const exonerate = useMutation({
    mutationFn: async ({ balance, reason }: { balance: ExonerableBalance; reason: string }) => {
      const trimmed = reason.trim();
      if (!trimmed) throw new Error("El motivo de la exoneración es obligatorio");
      const pendingVes = Number(balance.balance) || 0;
      if (pendingVes <= 0) throw new Error("Esta cuota no tiene saldo pendiente por exonerar");

      const currency = balance.currency || "VES";
      const snapshot = Number(balance.exchange_rate_snapshot) || 1;
      const pendingOriginal = currency === "VES" ? pendingVes : pendingVes / snapshot;

      const { error: insErr } = await supabase.from("concept_exonerations").insert({
        school_id: balance.school_id,
        school_year_id: balance.school_year_id,
        student_id: balance.student_id,
        balance_id: balance.id,
        plan_concept_id: balance.plan_concept_id,
        amount_ves: parseFloat(pendingVes.toFixed(2)),
        original_amount: currency === "VES" ? null : parseFloat(pendingOriginal.toFixed(4)),
        currency,
        exchange_rate: snapshot,
        reason: trimmed,
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      // El ledger conserva paid_amount + balance = total_amount: lo exonerado se suma a
      // paid_amount (no es dinero; el dashboard lo resta de "Total recaudado").
      const { error: balErr } = await supabase.from("student_concept_balances").update({
        paid_amount: parseFloat(((Number(balance.paid_amount) || 0) + pendingVes).toFixed(2)),
        balance: 0,
        status: "exonerated",
      }).eq("id", balance.id);
      if (balErr) throw balErr;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Cuota exonerada", description: "El saldo quedó en cero y sale del listado de morosos." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  /** Deshace una exoneración: devuelve el pendiente exonerado a la cuota. */
  const revert = useMutation({
    mutationFn: async ({ exoneration, balance }: { exoneration: ConceptExoneration; balance: ExonerableBalance }) => {
      const restored = Number(exoneration.amount_ves) || 0;
      const newPaid = Math.max(0, (Number(balance.paid_amount) || 0) - restored);
      const total = Number(balance.total_amount) || 0;
      const newBalance = parseFloat(Math.max(0, total - newPaid).toFixed(2));

      const { error: balErr } = await supabase.from("student_concept_balances").update({
        paid_amount: parseFloat(newPaid.toFixed(2)),
        balance: newBalance,
        status: newPaid <= 0 ? "pending" : (newBalance <= 0 ? "paid" : "partial"),
      }).eq("id", balance.id);
      if (balErr) throw balErr;

      // La fila no se borra: queda la auditoría de quién exoneró y quién revirtió
      const { error: exErr } = await supabase.from("concept_exonerations").update({
        reverted_at: new Date().toISOString(),
        reverted_by: user?.id ?? null,
      }).eq("id", exoneration.id);
      if (exErr) throw exErr;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Exoneración revertida", description: "La cuota volvió a quedar pendiente." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return {
    exonerations: exonerationsQuery.data || [],
    byBalanceId,
    isLoading: exonerationsQuery.isLoading,
    exonerate,
    revert,
  };
}
