import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useSchoolModules } from "@/hooks/useSchoolModules";
import { usePayrollBeneficiaries } from "@/hooks/payroll/usePayrollBeneficiaries";
import { usePayrollTeachers } from "@/hooks/payroll/usePayrollTeachers";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { usePayrollAriRates } from "@/hooks/payroll/usePayrollAriRates";
import { BeneficiaryTeacherFields } from "@/components/payroll/BeneficiaryTeacherFields";
import { todayCaracasIso, formatDateOnly } from "@/lib/dateUtils";
import { TEACHING_MODULES } from "@/lib/modules/moduleRequirement";
import { CATEGORY_LABELS, type PayrollBeneficiary, type PayrollCategory } from "@/lib/payroll/types";
import { defaultRegimeFor, getBeneficiaryFieldRules } from "@/lib/payroll/withholdings/beneficiaryRules";
import {
  buildBeneficiaryFormSchema,
  NO_ISLR_CONCEPT,
  toBeneficiaryPayload,
  type BeneficiaryFormValues,
} from "@/lib/payroll/withholdings/beneficiaryFormSchema";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";
import { buildDocumentId, DOCUMENT_TYPES, parseDocumentId } from "@/lib/payroll/withholdings/taxId";
import { PERSON_TYPE_LABELS, VAT_MODE_LABELS, type PersonType } from "@/lib/payroll/withholdings/types";

interface BeneficiaryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  beneficiary?: PayrollBeneficiary | null;
  /** Starting category when creating, e.g. from the suppliers tab. */
  initialCategory?: PayrollCategory;
  onSaved?: (beneficiaryId: string) => void;
}

const CATEGORY_ORDER: PayrollCategory[] = ["teacher", "admin", "worker", "supplier", "other"];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function initialValues(
  beneficiary: PayrollBeneficiary | null | undefined,
  initialCategory: PayrollCategory,
  hasActiveTeachers: boolean
): BeneficiaryFormValues {
  const category = beneficiary?.category ?? initialCategory;
  const document = parseDocumentId(beneficiary?.document_id);
  const isLinked = beneficiary ? !!beneficiary.teacher_id : hasActiveTeachers;
  return {
    category,
    regime: beneficiary?.payment_regime ?? defaultRegimeFor(category),
    teacherMode: isLinked ? "linked" : "payroll_only",
    teacherId: beneficiary?.teacher_id ?? "",
    fullName: beneficiary?.full_name ?? "",
    documentType: document.type,
    documentNumber: document.number,
    taxId: beneficiary?.tax_id ?? "",
    personType: beneficiary?.person_type ?? "",
    fiscalAddress: beneficiary?.fiscal_address ?? "",
    email: beneficiary?.email ?? "",
    phone: beneficiary?.phone ?? "",
    notes: beneficiary?.notes ?? "",
    jobTitle: beneficiary?.job_title ?? "",
    hireDate: beneficiary?.hire_date ?? "",
    monthlyHours: beneficiary?.monthly_hours != null ? String(beneficiary.monthly_hours) : "",
    ariRate: "",
    ariValidFrom: todayCaracasIso(),
    vatMode: beneficiary?.vat_withholding_mode ?? "standard",
    vatExclusionReason: beneficiary?.vat_exclusion_reason ?? "",
    islrConceptId: beneficiary?.default_islr_concept_id ?? (beneficiary?.payment_regime === "invoice" ? NO_ISLR_CONCEPT : ""),
  };
}

export function BeneficiaryFormModal({
  open,
  onOpenChange,
  schoolId,
  beneficiary,
  initialCategory = "other",
  onSaved,
}: BeneficiaryFormModalProps) {
  const { toast } = useToast();
  const { has } = usePermissions();
  const { isActive } = useSchoolModules();
  const { createBeneficiary, updateBeneficiary } = usePayrollBeneficiaries(schoolId);
  const { data: teachers = [] } = usePayrollTeachers(schoolId);
  const { vatEnabled, islrEnabled, concepts } = usePayrollTaxConfig(schoolId);
  const { ratesByBeneficiary, addAriRate } = usePayrollAriRates(schoolId);
  const [savingAri, setSavingAri] = useState(false);

  const isEdit = !!beneficiary;
  const currentAri = beneficiary
    ? resolveRateVersion(ratesByBeneficiary[beneficiary.id] ?? [], todayCaracasIso())
    : null;

  // Only active teachers can be picked; an existing link stays visible even if suspended later.
  const pickableTeachers = useMemo(
    () => teachers.filter((t) => !t.isSuspended || t.id === beneficiary?.teacher_id),
    [teachers, beneficiary?.teacher_id]
  );
  const hasActiveTeachers = pickableTeachers.length > 0;
  const canAddInTeachersArea = has("teachers.manage") && TEACHING_MODULES.some((m) => isActive(m));

  const context = { vatEnabled, islrEnabled, hasAriRate: !!currentAri };
  const resolver = useMemo(
    () => zodResolver(buildBeneficiaryFormSchema({ vatEnabled, islrEnabled, hasAriRate: !!currentAri })),
    [vatEnabled, islrEnabled, currentAri]
  );

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<BeneficiaryFormValues>({
    resolver,
    defaultValues: initialValues(beneficiary, initialCategory, hasActiveTeachers),
  });

  useEffect(() => {
    if (open) reset(initialValues(beneficiary, initialCategory, hasActiveTeachers));
  }, [open, beneficiary, initialCategory, hasActiveTeachers, reset]);

  const category = watch("category");
  const regime = watch("regime");
  const personType = watch("personType") as PersonType | "";
  const teacherMode = watch("teacherMode");
  const teacherId = watch("teacherId");
  const vatMode = watch("vatMode");
  const email = watch("email");

  const rules = getBeneficiaryFieldRules({ category, regime, personType, vatEnabled, islrEnabled });
  const isInvoice = category === "supplier" || regime === "invoice";
  const mark = (rule: string) => (rule === "required" ? " *" : "");

  const onCategoryChange = (next: PayrollCategory) => {
    setValue("category", next);
    setValue("regime", isEdit && next !== "supplier" ? beneficiary!.payment_regime : defaultRegimeFor(next));
    setValue("teacherMode", next === "teacher" && hasActiveTeachers ? "linked" : "payroll_only");
  };

  const onPickTeacher = (id: string) => {
    setValue("teacherId", id, { shouldValidate: true });
    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) return;
    const document = parseDocumentId(teacher.document_id);
    setValue("fullName", teacher.name);
    setValue("documentType", document.type);
    setValue("documentNumber", document.number);
    setValue("email", teacher.email ?? "");
    setValue("phone", teacher.phone ?? "");
  };

  const isSaving = createBeneficiary.isPending || updateBeneficiary.isPending || savingAri;

  const onSubmit = async (values: BeneficiaryFormValues) => {
    const payload = toBeneficiaryPayload(values, context);

    // Registered only in payroll, but a teacher with that document exists: link them.
    if (payload.category === "teacher" && !payload.teacher_id && payload.document_id) {
      const match = teachers.find((t) => t.document_id === payload.document_id);
      if (match) payload.teacher_id = match.id;
    }

    try {
      let beneficiaryId = beneficiary?.id ?? "";
      if (isEdit && beneficiary) {
        await updateBeneficiary.mutateAsync({ id: beneficiary.id, ...payload });
      } else {
        beneficiaryId = await createBeneficiary.mutateAsync(payload);
      }

      if (rules.ariRate !== "hidden" && values.ariRate.trim()) {
        setSavingAri(true);
        await addAriRate.mutateAsync({
          beneficiary_id: beneficiaryId,
          valid_from: values.ariValidFrom,
          rate_pct: Number(values.ariRate),
        });
      }

      toast({ title: isEdit ? "Beneficiario actualizado" : "Beneficiario registrado" });
      onSaved?.(beneficiaryId);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingAri(false);
    }
  };

  const documentPreview = buildDocumentId(watch("documentType"), watch("documentNumber"));
  const linkedByDocument =
    category === "teacher" && teacherMode === "payroll_only" && documentPreview
      ? teachers.find((t) => t.document_id === documentPreview)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Beneficiario" : "Nuevo Beneficiario"}</DialogTitle>
        </DialogHeader>

        <form id="beneficiary-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-2 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={category} onValueChange={(v) => onCategoryChange(v as PayrollCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cómo se le paga *</Label>
              <Controller
                control={control}
                name="regime"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={rules.regimeLocked}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payroll">Nómina</SelectItem>
                      <SelectItem value="invoice">Factura u honorarios</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {category === "teacher" && (
            <BeneficiaryTeacherFields
              teachers={pickableTeachers}
              mode={teacherMode}
              teacherId={teacherId}
              error={errors.teacherId?.message}
              canAddInTeachersArea={canAddInTeachersArea}
              onModeChange={(mode) => setValue("teacherMode", mode)}
              onPickTeacher={onPickTeacher}
            />
          )}

          {rules.personType !== "hidden" && (
            <div className="space-y-2">
              <Label>Tipo de persona{mark(rules.personType)}</Label>
              <Controller
                control={control}
                name="personType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PERSON_TYPE_LABELS) as PersonType[]).map((p) => (
                        <SelectItem key={p} value={p}>{PERSON_TYPE_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.personType?.message} />
            </div>
          )}

          <div className="space-y-2">
            <Label>{personType.startsWith("legal") ? "Razón social *" : "Nombre completo *"}</Label>
            <Input {...register("fullName")} placeholder={personType.startsWith("legal") ? "Empresa, C.A." : "Nombre y apellido"} />
            <FieldError message={errors.fullName?.message} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rules.document !== "hidden" && (
              <div className="space-y-2">
                <Label>Cédula o pasaporte{mark(rules.document)}</Label>
                <div className="flex gap-2">
                  <Controller
                    control={control}
                    name="documentType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Input {...register("documentNumber")} placeholder="12345678" className="min-w-0" />
                </div>
                <FieldError message={errors.documentNumber?.message} />
              </div>
            )}
            <div className="space-y-2">
              <Label>RIF{mark(rules.taxId)}</Label>
              <Input {...register("taxId")} placeholder="J-12345678-9" />
              <FieldError message={errors.taxId?.message} />
            </div>
          </div>

          {linkedByDocument && (
            <p className="text-xs text-muted-foreground">
              Ya hay un docente con esta cédula ({linkedByDocument.name}): se vinculará al guardar.
            </p>
          )}

          {rules.fiscalAddress !== "hidden" && (
            <div className="space-y-2">
              <Label>Domicilio fiscal{mark(rules.fiscalAddress)}</Label>
              <Textarea {...register("fiscalAddress")} rows={2} />
              <FieldError message={errors.fiscalAddress?.message} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Correo{mark(rules.email)}</Label>
              <Input type="email" {...register("email")} placeholder="correo@ejemplo.com" />
              <FieldError message={errors.email?.message} />
              {!isInvoice && !email.trim() && (
                <p className="text-xs text-muted-foreground">Sin correo no recibirá su recibo de pago.</p>
              )}
              {isInvoice && <p className="text-xs text-muted-foreground">Se usa para enviar el comprobante de retención.</p>}
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input {...register("phone")} />
            </div>
          </div>

          {!isInvoice && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="beneficiary-job-title">Cargo</Label>
                <Input id="beneficiary-job-title" {...register("jobTitle")} placeholder="Aseadora, Mantenimiento, Docente..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiary-hire-date">Fecha de ingreso</Label>
                <Input id="beneficiary-hire-date" type="date" max={todayCaracasIso()} {...register("hireDate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiary-monthly-hours">Horas al mes</Label>
                <Input id="beneficiary-monthly-hours" type="number" min="1" step="any" {...register("monthlyHours")} placeholder="160" />
                <FieldError message={errors.monthlyHours?.message} />
                <p className="text-xs text-muted-foreground">Para descontar las horas no trabajadas.</p>
              </div>
            </div>
          )}

          {rules.ariRate !== "hidden" && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">Retención de ISLR (AR-I)</p>
              {currentAri && (
                <p className="text-xs text-muted-foreground">
                  Vigente: {currentAri.rate_pct} % desde {formatDateOnly(currentAri.valid_from)}. Escriba un nuevo
                  porcentaje solo si cambió; los pagos anteriores conservan el suyo.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{currentAri ? "Nuevo % AR-I" : `% AR-I${mark(rules.ariRate)}`}</Label>
                  <Input type="number" step="0.01" min="0" max="100" {...register("ariRate")} />
                  <FieldError message={errors.ariRate?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Aplica desde</Label>
                  <Input type="date" {...register("ariValidFrom")} />
                  <FieldError message={errors.ariValidFrom?.message} />
                </div>
              </div>
            </div>
          )}

          {rules.vatMode !== "hidden" && (
            <div className="space-y-2">
              <Label>Retención de IVA{mark(rules.vatMode)}</Label>
              <Controller
                control={control}
                name="vatMode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VAT_MODE_LABELS) as (keyof typeof VAT_MODE_LABELS)[]).map((m) => (
                        <SelectItem key={m} value={m}>{VAT_MODE_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {vatMode === "excluded" && (
                <>
                  <Input {...register("vatExclusionReason")} placeholder="Motivo: contribuyente formal, servicio domiciliado..." />
                  <FieldError message={errors.vatExclusionReason?.message} />
                </>
              )}
            </div>
          )}

          {rules.islrConcept !== "hidden" && (
            <div className="space-y-2">
              <Label>Concepto de ISLR habitual{mark(rules.islrConcept)}</Label>
              <Controller
                control={control}
                name="islrConceptId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ISLR_CONCEPT}>No aplica (solo vende bienes)</SelectItem>
                      {concepts.filter((c) => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.islrConceptId?.message} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea {...register("notes")} rows={2} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="beneficiary-form" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
            {isEdit ? "Guardar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
