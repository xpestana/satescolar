import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatGradeLevel } from "@/lib/utils";
import { familySurname, buildPrimaryRepMap } from "@/lib/familyDisplayName";
import { buildPaymentReportRows, type RawExoneration, type RawPayment } from "@/lib/paymentsReportRows";
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

export interface PlanOption { id: string; name: string }
export interface MethodOption { id: string; label: string }

const studentFullName = (student: StudentRow) => {
  const fd = (student.form_data || {}) as Record<string, string | undefined>;
  return [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
    .filter(Boolean).join(" ") || "Sin nombre";
};

/**
 * Datos del Reporte de Pagos para un año escolar: pagos con todo su detalle, exoneraciones y
 * los catálogos que alimentan los filtros (planes y métodos del colegio).
 *
 * Se trae el año completo y se filtra/ordena en cliente: el volumen por año son cientos de
 * facturas, y así la búsqueda y el orden responden sin ir al servidor en cada tecla.
 */
export function usePaymentsReportData(schoolId?: string | null, schoolYearId?: string | null) {
  const enabled = !!schoolId && !!schoolYearId;

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["payments-report", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select(`
        id, payment_date, created_at, status, invoice_number, control_number,
        invoice_name, invoice_rif, observations, total_amount_ves, student_id, family_id,
        payment_method_entries(method, currency, amount_ves, amount_original, exchange_rate, reference_code, bank_name),
        payment_items(
          id, student_id, amount_ves, original_amount, is_partial,
          discount_amount_ves, discount_reason,
          payment_plan_concepts(
            plan_id, currency, concept_id,
            payment_plans(name),
            payment_concepts(id, name, concept_type)
          )
        ),
        payment_others(id, amount_ves, notes)
      `)
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RawPayment[];
    },
    enabled,
  });

  const { data: exonerations = [], isLoading: loadingExonerations } = useQuery({
    queryKey: ["payments-report-exonerations", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("concept_exonerations").select(`
        id, payment_id, student_id, amount_ves, original_amount, currency, reason, created_at,
        payment_plan_concepts(
          plan_id,
          payment_plans(name),
          payment_concepts(name, concept_type)
        )
      `)
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!)
        .is("reverted_at", null);
      if (error) throw error;
      return (data || []) as unknown as RawExoneration[];
    },
    enabled,
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

  const { data: plans = [] } = useQuery({
    queryKey: ["payments-report-plans", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("payment_plans")
        .select("id, name").eq("school_id", schoolId!).order("name");
      return (data || []) as PlanOption[];
    },
    enabled: !!schoolId,
  });

  const context = useMemo(() => {
    const primaryRepByFamily = buildPrimaryRepMap(representatives);
    const familyById = new Map(families.map((f) => [f.id, f]));

    const studentGrades: Record<string, string> = {};
    enrollments.forEach((e) => {
      const grade = formatGradeLevel(e.sections?.grade_level || "");
      studentGrades[e.student_id] = e.sections?.name ? `${grade} - ${e.sections.name}` : grade;
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

    // Grado y sección "crudos" (enum + nombre) los necesita la factura sobre el formato
    const studentGradeLevels: Record<string, string> = {};
    const studentSections: Record<string, string> = {};
    enrollments.forEach((e) => {
      studentGradeLevels[e.student_id] = e.sections?.grade_level || "";
      studentSections[e.student_id] = e.sections?.name || "";
    });

    const methodLabels: Record<string, string> = {};
    schoolMethods.forEach((m) => { methodLabels[m.id] = m.label; });

    return {
      studentNames, studentDocuments, studentGrades, studentFamilies, methodLabels,
      studentGradeLevels, studentSections,
    };
  }, [students, families, representatives, enrollments, schoolMethods]);

  const rows: PaymentReportRow[] = useMemo(
    () => buildPaymentReportRows(payments, exonerations, context),
    [payments, exonerations, context],
  );

  /** Pago completo por id: lo necesitan la factura y el recibo, que trabajan sobre el pago entero. */
  const paymentsById = useMemo(() => new Map(payments.map((p) => [p.id, p])), [payments]);

  return {
    rows,
    paymentsById,
    context,
    isLoading: loadingPayments || loadingExonerations,
    plans,
    methods: schoolMethods,
  };
}
