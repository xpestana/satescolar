import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  applyConceptExoneration,
  revertConceptExoneration,
  type ConceptExoneration,
  type ExonerableBalance,
} from "@/lib/conceptExonerations";

export type { ConceptExoneration, ExonerableBalance };

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

/** Invalida todo lo que depende de saldos tras exonerar o revertir. */
export function invalidateExonerationQueries(qc: ReturnType<typeof useQueryClient>) {
  AFFECTED_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
}

/**
 * Exoneraciones vigentes de las cuotas de unos estudiantes, con la acción de revertir.
 * La exoneración se **aplica** al registrar el pago (ver `PaymentFormModal`); aquí se consulta
 * para mostrarla en el estado de cuenta y poder deshacerla.
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

  const revert = useMutation({
    mutationFn: ({ exoneration, balance }: { exoneration: ConceptExoneration; balance: ExonerableBalance }) =>
      revertConceptExoneration({ exoneration, balance, userId: user?.id ?? null }),
    onSuccess: () => {
      invalidateExonerationQueries(qc);
      toast({ title: "Exoneración revertida", description: "La cuota volvió a quedar pendiente." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  /** Exonerar fuera del registro de pago (uso puntual; el flujo normal es el modal de pago). */
  const exonerate = useMutation({
    mutationFn: ({ balance, reason }: { balance: ExonerableBalance; reason: string }) =>
      applyConceptExoneration({ balance, reason, userId: user?.id ?? null }),
    onSuccess: () => {
      invalidateExonerationQueries(qc);
      toast({ title: "Cuota exonerada", description: "El saldo quedó en cero y sale del listado de morosos." });
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
