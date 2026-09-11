import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatGradeLevel } from "@/lib/utils";
import { familySurname, buildPrimaryRepMap } from "@/lib/familyDisplayName";
import {
  buildPaymentReportRows,
  type PlanConceptInfo,
  type RawExoneration,
  type RawFamilyCredit,
  type RawMethodEntry,
  type RawPayment,
  type RawPaymentItem,
  type RawPaymentOther,
} from "@/lib/paymentsReportRows";
import type { PaymentReportRow } from "@/lib/paymentsReport";

interface StudentRow {
  id: string;
  document_id: string | null;
  form_data: Record<string, unknown> | null;
  family_id: string | null;
}

interface FamilyRow {
  id: string;
  father_last_name: string | null;
  mother_last_name: string | null;
}

interface RepresentativeRow {
  family_id: string;
  is_primary: boolean | null;
  form_data: Record<string, unknown> | null;
}

interface EnrollmentRow {
  student_id: string;
  sections: { name: string | null; grade_level: string | null } | null;
}

interface PlanConceptRow {
  id: string;
  plan_id: string | null;
  currency: string | null;
  concept_id: string | null;
  payment_plans: { name: string | null } | null;
  payment_concepts: { name: string | null; concept_type: string | null; lineage_id: string | null } | null;
}

export interface PlanOption { id: string; name: string }
export interface MethodOption { id: string; label: string }

const studentFullName = (student: StudentRow) => {
  const fd = (student.form_data || {}) as Record<string, string | undefined>;
  return [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
    .filter(Boolean).join(" ") || "Sin nombre";
};

/**
 * Datos del Reporte de Pagos para un año escolar.
 *
 * **Consultas planas, no anidadas.** Antes se pedía un solo `select` con
 * `payments → payment_items → payment_plan_concepts → payment_plans/payment_concepts`
 * embebidos; cada nivel vuelve a evaluar las políticas RLS del anterior y la consulta expiraba
 * (`57014: canceling statement due to statement timeout`) en años con cientos de facturas.
 * Ahora se piden las tablas por separado —en paralelo— y se unen en `buildPaymentReportRows`;
 * el catálogo de conceptos del plan se trae una sola vez por colegio.
 *
 * El año completo se filtra/ordena en cliente para que buscar no dispare una consulta por tecla.
 */
export function usePaymentsReportData(schoolId?: string | null, schoolYearId?: string | null) {
  const enabled = !!schoolId && !!schoolYearId;

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["payments-report", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments")
        .select("id, payment_date, created_at, status, invoice_number, control_number, invoice_name, invoice_rif, observations, total_amount_ves, student_id")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RawPayment[];
    },
    enabled,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["payments-report-items", schoolId, schoolYearId],
    queryFn: async () => {
      // Las líneas se acotan al año con un embebido `!inner` sobre la factura, sin traerla
      const { data, error } = await supabase.from("payment_items")
        .select("id, payment_id, student_id, plan_concept_id, amount_ves, original_amount, is_partial, discount_amount_ves, discount_reason, payments!inner(school_id, school_year_id)")
        .eq("payments.school_id", schoolId!)
        .eq("payments.school_year_id", schoolYearId!);
      if (error) throw error;
      return (data || []) as unknown as RawPaymentItem[];
    },
    enabled,
  });

  const { data: methodEntries = [] } = useQuery({
    queryKey: ["payments-report-methods-entries", schoolId, schoolYearId],
    queryFn: async () => {
      // Las líneas se acotan al año con un embebido `!inner` sobre la factura, sin traerla
      const { data, error } = await supabase.from("payment_method_entries")
        .select("payment_id, method, currency, reference_code, bank_name, payments!inner(school_id, school_year_id)")
        .eq("payments.school_id", schoolId!)
        .eq("payments.school_year_id", schoolYearId!);
      if (error) throw error;
      return (data || []) as unknown as RawMethodEntry[];
    },
    enabled,
  });

  const { data: others = [] } = useQuery({
    queryKey: ["payments-report-others", schoolId, schoolYearId],
    queryFn: async () => {
      // Las líneas se acotan al año con un embebido `!inner` sobre la factura, sin traerla
      const { data, error } = await supabase.from("payment_others")
        .select("id, payment_id, amount_ves, notes, payments!inner(school_id, school_year_id)")
        .eq("payments.school_id", schoolId!)
        .eq("payments.school_year_id", schoolYearId!);
      if (error) throw error;
      return (data || []) as unknown as RawPaymentOther[];
    },
    enabled,
  });

  const { data: exonerations = [], isLoading: loadingExonerations } = useQuery({
    queryKey: ["payments-report-exonerations", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("concept_exonerations")
        .select("id, payment_id, student_id, plan_concept_id, amount_ves, original_amount, currency, reason, created_at")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!)
        .is("reverted_at", null);
      if (error) throw error;
      return (data || []) as unknown as RawExoneration[];
    },
    enabled,
  });

  // Saldo a favor generado o consumido por cada factura (lo escribe el registro de pagos)
  const { data: credits = [] } = useQuery({
    queryKey: ["payments-report-credits", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("family_credits")
        .select("entry_type, amount_ves, source_payment_id, applied_payment_id")
        .eq("school_id", schoolId!);
      if (error) throw error;
      return (data || []) as unknown as RawFamilyCredit[];
    },
    enabled: !!schoolId,
  });

  // Catálogo del colegio: resuelve plan y concepto de cada cuota sin anidar por línea
  const { data: planConceptRows = [] } = useQuery({
    queryKey: ["payments-report-plan-concepts", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_plan_concepts")
        .select("id, plan_id, currency, concept_id, payment_plans!inner(name, school_id), payment_concepts(name, concept_type, lineage_id)")
        .eq("payment_plans.school_id", schoolId!);
      if (error) throw error;
      return (data || []) as unknown as PlanConceptRow[];
    },
    enabled: !!schoolId,
  });

  // Estudiantes del colegio (incluye no inscritos y egresados: el reporte es histórico)
  const { data: students = [] } = useQuery({
    queryKey: ["payments-report-students", schoolId],
    queryFn: async () => {
      const { data: links } = await supabase.from("student_schools").select("student_id").eq("school_id", schoolId!);
      const ids = (links || []).map((r) => r.student_id);
      if (ids.length === 0) return [] as StudentRow[];
      const { data } = await supabase.from("students")
        .select("id, document_id, form_data, family_id")
        .in("id", ids);
      return (data || []) as unknown as StudentRow[];
    },
    enabled: !!schoolId,
  });

  const familyIds = useMemo(
    () => [...new Set(students.map((s) => s.family_id).filter(Boolean))] as string[],
    [students],
  );

  const { data: families = [] } = useQuery({
    queryKey: ["payments-report-families", schoolId, familyIds.length],
    queryFn: async () => {
      const { data } = await supabase.from("families")
        .select("id, father_last_name, mother_last_name")
        .in("id", familyIds);
      return (data || []) as unknown as FamilyRow[];
    },
    enabled: familyIds.length > 0,
  });

  const { data: representatives = [] } = useQuery({
    queryKey: ["payments-report-reps", schoolId, familyIds.length],
    queryFn: async () => {
      const { data } = await supabase.from("representatives")
        .select("family_id, is_primary, form_data")
        .in("family_id", familyIds);
      return (data || []) as unknown as RepresentativeRow[];
    },
    enabled: familyIds.length > 0,
  });

  // Grado y sección alimentan tanto la columna del reporte como la factura impresa
  const { data: enrollments = [] } = useQuery({
    queryKey: ["payments-report-enrollments", schoolId, schoolYearId],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments")
        .select("student_id, sections(name, grade_level)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!);
      return (data || []) as unknown as EnrollmentRow[];
    },
    enabled,
  });

  const { data: schoolMethods = [] } = useQuery({
    queryKey: ["payments-report-methods", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods")
        .select("id, label").eq("school_id", schoolId!);
      return (data || []) as MethodOption[];
    },
    enabled: !!schoolId,
  });

  // Opciones del filtro "Plan": los planes son por año escolar, así que solo los del año del reporte
  const { data: plans = [] } = useQuery({
    queryKey: ["payments-report-plans", schoolId, schoolYearId],
    queryFn: async () => {
      const { data } = await supabase.from("payment_plans")
        .select("id, name").eq("school_id", schoolId!).eq("school_year_id", schoolYearId!).order("name");
      return (data || []) as PlanOption[];
    },
    enabled,
  });

  const context = useMemo(() => {
    const primaryRepByFamily = buildPrimaryRepMap(representatives);
    const familyById = new Map(families.map((f) => [f.id, f]));

    const studentGrades: Record<string, string> = {};
    const studentGradeLevels: Record<string, string> = {};
    const studentSections: Record<string, string> = {};
    enrollments.forEach((e) => {
      const grade = formatGradeLevel(e.sections?.grade_level || "");
      studentGrades[e.student_id] = e.sections?.name ? `${grade} - ${e.sections.name}` : grade;
      // Grado y sección "crudos" (enum + nombre) los necesita la factura sobre el formato
      studentGradeLevels[e.student_id] = e.sections?.grade_level || "";
      studentSections[e.student_id] = e.sections?.name || "";
    });

    const studentNames: Record<string, string> = {};
    const studentDocuments: Record<string, string> = {};
    const studentFamilies: Record<string, string> = {};
    students.forEach((s) => {
      studentNames[s.id] = studentFullName(s);
      studentDocuments[s.id] = s.document_id || "";
      const family = s.family_id ? familyById.get(s.family_id) : undefined;
      studentFamilies[s.id] = family ? familySurname(family, primaryRepByFamily[family.id]) : "";
    });

    const methodLabels: Record<string, string> = {};
    schoolMethods.forEach((m) => { methodLabels[m.id] = m.label; });

    const planConcepts: Record<string, PlanConceptInfo> = {};
    planConceptRows.forEach((pc) => {
      planConcepts[pc.id] = {
        plan_id: pc.plan_id,
        plan_name: pc.payment_plans?.name ?? "",
        currency: pc.currency,
        concept_id: pc.concept_id,
        concept_name: pc.payment_concepts?.name ?? "",
        concept_type: pc.payment_concepts?.concept_type ?? "",
      };
    });

    return {
      studentNames, studentDocuments, studentGrades, studentFamilies, methodLabels, planConcepts,
      studentGradeLevels, studentSections,
    };
  }, [students, families, representatives, enrollments, schoolMethods, planConceptRows]);

  const rows: PaymentReportRow[] = useMemo(
    () => buildPaymentReportRows({ payments, items, methodEntries, others, exonerations, credits }, context),
    [payments, items, methodEntries, others, exonerations, credits, context],
  );

  /** Pago con su detalle, para la factura y el recibo, que trabajan sobre el pago entero. */
  const paymentsById = useMemo(() => {
    // Linaje del concepto de cada cuota: la factura marca los conceptos por linaje (estable entre años)
    const lineageByPlanConcept = new Map(planConceptRows.map((pc) => [pc.id, pc.payment_concepts?.lineage_id ?? null]));
    const byId = new Map(payments.map((p) => [p.id, {
      ...p,
      payment_items: [] as (RawPaymentItem & { payment_plan_concepts?: unknown })[],
      payment_method_entries: [] as RawMethodEntry[],
      payment_others: [] as RawPaymentOther[],
    }]));
    items.forEach((it) => {
      const payment = byId.get(String(it.payment_id));
      if (!payment) return;
      const info = context.planConcepts[String(it.plan_concept_id)];
      payment.payment_items.push({
        ...it,
        // `buildInvoiceData` marca los conceptos por su id, así que se rehidrata el anidado
        payment_plan_concepts: info
          ? {
              concept_id: info.concept_id,
              payment_concepts: {
                id: info.concept_id,
                name: info.concept_name,
                lineage_id: lineageByPlanConcept.get(String(it.plan_concept_id)) ?? null,
              },
            }
          : null,
      });
    });
    methodEntries.forEach((m) => byId.get(String(m.payment_id))?.payment_method_entries.push(m));
    others.forEach((o) => byId.get(String(o.payment_id))?.payment_others.push(o));
    return byId;
  }, [payments, items, methodEntries, others, context, planConceptRows]);

  return {
    rows,
    paymentsById,
    context,
    isLoading: loadingPayments || loadingItems || loadingExonerations,
    plans,
    methods: schoolMethods,
  };
}
